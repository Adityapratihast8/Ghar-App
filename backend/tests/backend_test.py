"""Ghar.com backend API test suite."""
import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://direct-listing-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

# Test phones - unique per test run to avoid collision
import random
RUN = uuid.uuid4().hex[:6]
# Digits-only 10-digit phone (backend normalizer strips non-digits & requires exactly 10)
NEW_BUYER_PHONE = "98" + "".join(random.choices("0123456789", k=8))


def _post(path, body=None, token=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=body or {}, headers=h, timeout=60)


def _get(path, token=None, params=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", headers=h, params=params, timeout=30)


def _put(path, body=None, token=None, params=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.put(f"{API}{path}", json=body, headers=h, params=params, timeout=30)


def _delete(path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.delete(f"{API}{path}", headers=h, timeout=30)


def _login(phone):
    _post("/auth/send-otp", {"phone": phone})
    r = _post("/auth/verify-otp", {"phone": phone, "otp": "123456"})
    assert r.status_code == 200, r.text
    d = r.json()
    return d["token"], d["user"]


# ---------------- Session-level fixtures ----------------
@pytest.fixture(scope="session")
def admin_ctx():
    tok, user = _login("9999999999")
    assert user["role"] == "admin", f"Admin seed missing/wrong: {user}"
    return {"token": tok, "user": user}


@pytest.fixture(scope="session")
def owner_ctx():
    tok, user = _login("9111111111")
    return {"token": tok, "user": user}


@pytest.fixture(scope="session")
def buyer_ctx():
    tok, user = _login("9222222222")
    return {"token": tok, "user": user}


# ---------------- Auth tests ----------------
class TestAuth:
    def test_send_otp_valid(self):
        r = _post("/auth/send-otp", {"phone": "9000000001"})
        assert r.status_code == 200
        assert r.json().get("success") is True

    def test_send_otp_invalid_short(self):
        r = _post("/auth/send-otp", {"phone": "123"})
        assert r.status_code == 400

    def test_verify_otp_wrong(self):
        r = _post("/auth/verify-otp", {"phone": "9000000001", "otp": "000000"})
        assert r.status_code == 400

    def test_verify_otp_creates_new_user_buyer(self):
        r = _post("/auth/verify-otp", {"phone": NEW_BUYER_PHONE, "otp": "123456"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and "user" in d
        assert d["user"]["role"] == "buyer"
        assert d["user"]["profile_complete"] is False
        assert d["is_new"] in (True, False)  # may already exist across reruns
        pytest.new_buyer_token = d["token"]
        pytest.new_buyer_user = d["user"]

    def test_me_with_token(self, buyer_ctx):
        r = _get("/auth/me", token=buyer_ctx["token"])
        assert r.status_code == 200
        assert r.json()["user"]["id"] == buyer_ctx["user"]["id"]

    def test_me_no_token(self):
        r = _get("/auth/me")
        assert r.status_code == 401

    def test_complete_profile_owner_role(self):
        # use freshly created user
        token = getattr(pytest, "new_buyer_token", None)
        assert token, "prerequisite verify test failed"
        r = _post(
            "/auth/complete-profile",
            {"name": "TEST User", "email": "test@example.com", "role": "owner"},
            token=token,
        )
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["role"] == "owner"
        assert u["profile_complete"] is True


# ---------------- Property listing tests ----------------
class TestPropertyList:
    def test_list_all_approved(self):
        r = _get("/properties")
        assert r.status_code == 200
        props = r.json()
        assert isinstance(props, list)
        assert len(props) >= 5, f"expected >=5 seed props, got {len(props)}"
        # ensure all approved
        for p in props:
            assert p["status"] == "approved"

    def test_filter_listing_type_rent(self):
        r = _get("/properties", params={"listing_type": "rent"})
        assert r.status_code == 200
        for p in r.json():
            assert p["listing_type"] == "rent"

    def test_filter_city_mumbai(self):
        r = _get("/properties", params={"city": "Mumbai"})
        assert r.status_code == 200
        assert all("mumbai" in p["city"].lower() for p in r.json())

    def test_filter_featured(self):
        r = _get("/properties", params={"featured": "true"})
        assert r.status_code == 200
        assert all(p["featured"] for p in r.json())

    def test_filter_verified(self):
        r = _get("/properties", params={"verified": "true"})
        assert r.status_code == 200
        assert all(p["verified"] for p in r.json())

    def test_filter_bedrooms(self):
        r = _get("/properties", params={"bedrooms": 3})
        assert r.status_code == 200
        for p in r.json():
            assert p["bedrooms"] == 3

    def test_filter_price_range(self):
        r = _get("/properties", params={"min_price": 20000, "max_price": 100000})
        assert r.status_code == 200
        for p in r.json():
            assert 20000 <= p["price"] <= 100000

    def test_get_single_property_with_owner(self):
        listing = _get("/properties").json()
        pid = listing[0]["id"]
        v0 = listing[0]["views"]
        r = _get(f"/properties/{pid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == pid
        assert "owner" in d and d["owner"] is not None
        assert "phone" in d["owner"]
        # view increment
        r2 = _get(f"/properties/{pid}")
        assert r2.json()["views"] >= v0 + 1

    def test_get_property_not_found(self):
        r = _get("/properties/does-not-exist")
        assert r.status_code == 404


# ---------------- Property CRUD by role ----------------
class TestPropertyCRUD:
    sample = {
        "title": "TEST Sample Property",
        "description": "TEST desc",
        "listing_type": "rent",
        "category": "apartment",
        "property_type": "residential",
        "price": 30000,
        "state": "Karnataka", "city": "Bengaluru", "locality": "TESTLoc",
        "bedrooms": 2, "bathrooms": 2, "area": 900,
    }

    def test_create_property_forbidden_for_buyer(self, buyer_ctx):
        r = _post("/properties", self.sample, token=buyer_ctx["token"])
        assert r.status_code == 403

    def test_create_property_ok_for_owner(self, owner_ctx):
        r = _post("/properties", self.sample, token=owner_ctx["token"])
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "pending"
        assert p["owner_id"] == owner_ctx["user"]["id"]
        pytest.new_prop_id = p["id"]

    def test_my_properties(self, owner_ctx):
        r = _get("/properties/mine", token=owner_ctx["token"])
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert pytest.new_prop_id in ids

    def test_update_property_own(self, owner_ctx):
        updated = {**self.sample, "title": "TEST Updated Title", "price": 35000}
        r = _put(f"/properties/{pytest.new_prop_id}", updated, token=owner_ctx["token"])
        assert r.status_code == 200
        assert r.json()["title"] == "TEST Updated Title"

    def test_admin_approve_and_feature(self, admin_ctx):
        r = _put(f"/admin/properties/{pytest.new_prop_id}/approve", token=admin_ctx["token"])
        assert r.status_code == 200
        r = _put(f"/admin/properties/{pytest.new_prop_id}/feature", token=admin_ctx["token"], params={"featured": "true"})
        assert r.status_code == 200
        got = _get(f"/properties/{pytest.new_prop_id}").json()
        assert got["status"] == "approved"
        assert got["featured"] is True


# ---------------- Wishlist ----------------
class TestWishlist:
    def test_wishlist_flow(self, buyer_ctx):
        pid = _get("/properties").json()[0]["id"]
        r = _post(f"/wishlist/{pid}", token=buyer_ctx["token"])
        assert r.status_code == 200
        r = _get("/wishlist", token=buyer_ctx["token"])
        assert r.status_code == 200
        assert any(p["id"] == pid for p in r.json())
        r = _delete(f"/wishlist/{pid}", token=buyer_ctx["token"])
        assert r.status_code == 200
        r = _get("/wishlist", token=buyer_ctx["token"])
        assert not any(p["id"] == pid for p in r.json())


# ---------------- Visits ----------------
class TestVisits:
    def test_visit_flow(self, buyer_ctx, owner_ctx):
        # find owner's approved property
        props = _get("/properties/mine", token=owner_ctx["token"]).json()
        approved = [p for p in props if p["status"] == "approved"]
        assert approved
        pid = approved[0]["id"]
        r = _post("/visits", {"property_id": pid, "scheduled_date": "2026-02-01", "message": "TEST visit"}, token=buyer_ctx["token"])
        assert r.status_code == 200
        vid = r.json()["id"]
        # both see it
        assert any(v["id"] == vid for v in _get("/visits", token=buyer_ctx["token"]).json())
        assert any(v["id"] == vid for v in _get("/visits", token=owner_ctx["token"]).json())
        # buyer cannot accept
        r = _put(f"/visits/{vid}", token=buyer_ctx["token"], params={"status": "accepted"})
        assert r.status_code == 403
        # owner can
        r = _put(f"/visits/{vid}", token=owner_ctx["token"], params={"status": "accepted"})
        assert r.status_code == 200


# ---------------- Chat ----------------
class TestChat:
    def test_chat_flow(self, buyer_ctx, owner_ctx):
        pid = _get("/properties/mine", token=owner_ctx["token"]).json()[0]["id"]
        r = _post("/chats/messages", {"property_id": pid, "to_user_id": owner_ctx["user"]["id"], "text": "TEST hello"}, token=buyer_ctx["token"])
        assert r.status_code == 200
        r = _post("/chats/messages", {"property_id": pid, "to_user_id": buyer_ctx["user"]["id"], "text": "TEST hi back"}, token=owner_ctx["token"])
        assert r.status_code == 200
        # thread messages
        r = _get("/chats/thread", token=buyer_ctx["token"], params={"property_id": pid, "other_user_id": owner_ctx["user"]["id"]})
        assert r.status_code == 200
        msgs = r.json()["messages"]
        assert len(msgs) >= 2
        # threads list
        r = _get("/chats/threads", token=buyer_ctx["token"])
        assert r.status_code == 200
        assert any(t["last_message"]["property_id"] == pid for t in r.json())


# ---------------- Admin ----------------
class TestAdmin:
    def test_admin_stats(self, admin_ctx):
        r = _get("/admin/stats", token=admin_ctx["token"])
        assert r.status_code == 200
        d = r.json()
        for k in ["total_users", "total_owners", "total_properties", "pending_verification", "approved", "total_rent", "total_sale"]:
            assert k in d
        assert d["approved"] >= 5

    def test_admin_list_pending(self, admin_ctx):
        r = _get("/admin/properties", token=admin_ctx["token"], params={"status": "pending"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_admin_forbidden_for_buyer(self, buyer_ctx):
        r = _get("/admin/stats", token=buyer_ctx["token"])
        assert r.status_code == 403


# ---------------- AI description ----------------
class TestAI:
    def test_generate_description(self, owner_ctx):
        payload = {
            "title": "TEST 2BHK Bandra",
            "category": "apartment",
            "listing_type": "rent",
            "bedrooms": 2, "area": 850, "city": "Mumbai", "locality": "Bandra",
            "amenities": ["Gym", "Pool"], "price": 65000,
        }
        r = _post("/ai/generate-description", payload, token=owner_ctx["token"])
        # allow a few seconds
        assert r.status_code == 200, r.text
        d = r.json()
        assert "description" in d and isinstance(d["description"], str) and len(d["description"]) > 20
