# Ghar.com — Product Requirements Document

## Overview
Ghar.com is a No-Broker property rental & sale platform for the Indian market. Users list, discover and rent/buy properties directly. Broker registration is disabled by design.

## MVP Scope (v1)
- OTP-based authentication (mock OTP `123456` for demo)
- Owner / Buyer / Admin roles
- Property listing (Rent or Sale) with images, amenities, location
- Property search with filters (listing type, BHK, verified, price, furnishing, category)
- Wishlist / Saved properties
- Chat with owner + Visit request scheduling
- Admin approval workflow for new listings
- AI-generated property descriptions (Gemini 3 Flash via Emergent LLM Key)
- Featured listings surfaced on Home

## Tech Stack
- **Frontend**: Expo Router (React Native), TypeScript, react-native-safe-area-context, react-native-keyboard-controller, @expo/vector-icons
- **Backend**: FastAPI, MongoDB (motor), JWT auth (PyJWT), emergentintegrations for AI
- **AI**: Gemini 3 Flash Preview via Emergent LLM Key
- **Deployment**: Kubernetes preview / Expo Go

## Key APIs (all under `/api`)
- `POST /auth/send-otp`, `POST /auth/verify-otp`, `POST /auth/complete-profile`, `GET /auth/me`
- `GET/POST/PUT/DELETE /properties`, `GET /properties/mine`, `GET /properties/{id}`
- `POST/DELETE /wishlist/{id}`, `GET /wishlist`
- `POST /visits`, `GET /visits`, `PUT /visits/{id}`
- `POST /chats/messages`, `GET /chats/threads`, `GET /chats/thread`
- `POST /ai/generate-description`
- `GET /admin/stats`, `GET /admin/properties`, `PUT /admin/properties/{id}/approve|reject|feature`

## Screens
1. Auth: phone → OTP → profile
2. Tabs: Home, Search, Saved, Chats, Profile
3. Property detail (image gallery, amenities, sticky Call/Chat/Visit CTAs)
4. Add property (3-step wizard, AI description button)
5. Chat detail
6. Admin panel (stats + approve/reject/feature)

## Design
- Primary: `#059669` (Emerald Green — trust)
- Secondary: `#D97706` (Amber — rent badges)
- Warm off-white background `#F9FAFB`
- Verified badges, featured stars, category chips (horizontal scroll only)

## Revenue Levers (future)
- Featured Listings (admin promotes property → paid boost)
- Premium subscription for Owners
- Verification charges
- Home loan / packers referral

## Deferred / Not in MVP
- Real SMS OTP (Twilio)
- Real image upload (S3 / Cloudinary) — currently uses seeded image URLs
- Video walkthroughs, 360° images
- Push notifications
- Payment gateway (Razorpay)
- Advanced AI (price suggestion, duplicate detection)
