"""Tests for Ghar.com v1.2 new features: reviews, bridge calls, admin extras, AI price/duplicate."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://direct-listing-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _post(path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=body or {}, headers=h, timeout=120)


def _get(path, token=None, params=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, params=params, timeout=30)


def _put(path, token=None, params=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.put(f"{API}{path}", headers=h, params=params, timeout=30)


def _login(phone):
    _post("/auth/send-otp", {"phone": phone})
    r = _post("/auth/verify-otp", {"phone": phone, "otp": "123456"})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


@pytest.fixture(scope="module")
def admin_ctx():
    tok, user = _login("9999999999")
    assert user["role"] == "admin"
    return {"token": tok, "user": user}


@pytest.fixture(scope="module")
def owner_ctx():
    tok, user = _login("9111111111")
    return {"token": tok, "user": user}


@pytest.fixture(scope="module")
def buyer_ctx():
    tok, user = _login("9222222222")
    return {"token": tok, "user": user}


@pytest.fixture(scope="module")
def sample_prop_id():
    props = _get("/properties").json()
    # find a property NOT owned by the buyer (all seeded are owned by owner)
    return props[0]["id"]


# ------------------ Reviews ------------------
class TestReviews:
    def test_initial_reviews_empty(self, sample_prop_id):
        r = _get(f"/properties/{sample_prop_id}/reviews")
        assert r.status_code == 200
        d = r.json()
        assert "reviews" in d and "avg_rating" in d and "count" in d

    def test_add_review_requires_auth(self, sample_prop_id):
        r = _post(f"/properties/{sample_prop_id}/reviews", {"property_id": sample_prop_id, "rating": 4, "comment": "TEST nice"})
        assert r.status_code == 401

    def test_add_review_rating_out_of_range(self, sample_prop_id, buyer_ctx):
        r = _post(f"/properties/{sample_prop_id}/reviews", {"property_id": sample_prop_id, "rating": 7, "comment": "TEST bad"}, token=buyer_ctx["token"])
        assert r.status_code == 400

    def test_add_review_ok_and_upsert(self, sample_prop_id, buyer_ctx):
        before = _get(f"/properties/{sample_prop_id}/reviews").json()
        before_count = before["count"]
        # first submission
        r = _post(f"/properties/{sample_prop_id}/reviews", {"property_id": sample_prop_id, "rating": 5, "comment": "TEST awesome"}, token=buyer_ctx["token"])
        assert r.status_code == 200, r.text
        # second submission from same user should UPDATE not duplicate
        r2 = _post(f"/properties/{sample_prop_id}/reviews", {"property_id": sample_prop_id, "rating": 3, "comment": "TEST changed my mind"}, token=buyer_ctx["token"])
        assert r2.status_code == 200
        after = _get(f"/properties/{sample_prop_id}/reviews").json()
        # Count should have increased by at most 1 from before (upsert -> stays same after 2nd)
        assert after["count"] == before_count + (0 if before_count > 0 and any(rev["user_id"] == buyer_ctx["user"]["id"] for rev in before["reviews"]) else 1)
        # latest comment reflected
        mine = [rev for rev in after["reviews"] if rev["user_id"] == buyer_ctx["user"]["id"]]
        assert mine and mine[0]["rating"] == 3
        assert "changed my mind" in mine[0]["comment"]


# ------------------ Bridge calls ------------------
class TestBridgeCalls:
    def test_bridge_config(self):
        r = _get("/config/bridge")
        assert r.status_code == 200
        d = r.json()
        assert "display" in d and "dial" in d

    def test_log_bridge_call_and_admin_list(self, sample_prop_id, buyer_ctx, admin_ctx):
        r = _post("/bridge-calls", {"property_id": sample_prop_id}, token=buyer_ctx["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["property_id"] == sample_prop_id
        assert d["caller_id"] == buyer_ctx["user"]["id"]
        assert d["owner_id"] and d["owner_phone"].startswith("+91")
        assert d["property_title"]
        assert d["status"] == "pending"
        pytest.call_req_id = d["id"]

        # admin list contains it
        r2 = _get("/admin/call-requests", token=admin_ctx["token"])
        assert r2.status_code == 200
        ids = [c["id"] for c in r2.json()]
        assert pytest.call_req_id in ids

    def test_admin_update_call_status(self, admin_ctx):
        rid = getattr(pytest, "call_req_id", None)
        assert rid, "prereq failed"
        r = _put(f"/admin/call-requests/{rid}", token=admin_ctx["token"], params={"status": "connected"})
        assert r.status_code == 200
        # invalid status
        r2 = _put(f"/admin/call-requests/{rid}", token=admin_ctx["token"], params={"status": "bogus"})
        assert r2.status_code == 400

    def test_admin_call_requests_forbidden_for_buyer(self, buyer_ctx):
        r = _get("/admin/call-requests", token=buyer_ctx["token"])
        assert r.status_code == 403


# ------------------ Admin Users ------------------
class TestAdminUsers:
    def test_admin_users_ok(self, admin_ctx):
        r = _get("/admin/users", token=admin_ctx["token"])
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 3
        phones = [u["phone"] for u in users]
        assert "+919999999999" in phones
        assert "+919111111111" in phones
        # no ObjectId leak
        assert all("_id" not in u for u in users)

    def test_admin_users_forbidden_for_buyer(self, buyer_ctx):
        r = _get("/admin/users", token=buyer_ctx["token"])
        assert r.status_code == 403

    def test_admin_users_forbidden_for_owner(self, owner_ctx):
        r = _get("/admin/users", token=owner_ctx["token"])
        assert r.status_code == 403


# ------------------ AI Price Suggest ------------------
class TestAIPriceSuggest:
    def test_price_suggest_structured(self, owner_ctx):
        payload = {
            "city": "Mumbai", "locality": "Andheri", "category": "apartment",
            "listing_type": "rent", "area": 1000, "bedrooms": 2,
        }
        r = _post("/ai/price-suggest", payload, token=owner_ctx["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        # Accept either structured OR raw fallback (should have `note`)
        if "per_sqft_min" in d:
            assert isinstance(d["per_sqft_min"], (int, float))
            assert d["per_sqft_max"] >= d["per_sqft_min"]
            assert d["estimated_total_max"] >= d["estimated_total_min"]
        else:
            pytest.fail(f"AI price-suggest did not return structured JSON: {d}")

    def test_price_suggest_requires_auth(self):
        r = _post("/ai/price-suggest", {"city": "Mumbai", "locality": "Andheri", "category": "apartment", "listing_type": "rent", "area": 500})
        assert r.status_code == 401


# ------------------ AI Duplicate Check ------------------
class TestAIDuplicateCheck:
    def test_duplicate_exact_seed_title(self, buyer_ctx):
        # buyer_ctx (buyer) not the owner, so seeded owner-owned props are candidates
        payload = {
            "title": "Spacious 3BHK Apartment in Powai",
            "city": "Mumbai", "locality": "Powai", "bedrooms": 3,
        }
        r = _post("/ai/check-duplicate", payload, token=buyer_ctx["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["duplicate"] is True
        assert d["matches"] and d["matches"][0]["similarity"] >= 0.99

    def test_duplicate_new_title_no_match(self, buyer_ctx):
        payload = {
            "title": "Completely Unrelated Random Zebra Property XYZ",
            "city": "Mumbai", "locality": "Powai", "bedrooms": 3,
        }
        r = _post("/ai/check-duplicate", payload, token=buyer_ctx["token"])
        assert r.status_code == 200
        d = r.json()
        assert d["duplicate"] is False
        # matches may still be returned but low similarity
        for m in d["matches"]:
            assert m["similarity"] < 0.5

    def test_duplicate_requires_auth(self):
        r = _post("/ai/check-duplicate", {"title": "x", "city": "Mumbai", "locality": "Powai"})
        assert r.status_code == 401
