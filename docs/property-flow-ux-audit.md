# Property Creation Flow — UX Audit

## Current Flow (15 screenshots analyzed)

```
Properties List → Add Property Wizard (4 steps) → Property Detail Page → Manual actions
```

---

## Issues Found (by severity)

### CRITICAL — User gets lost

**1. No guided path after property creation**
After the wizard saves the property, the user lands on the property detail page with 8 different sections (Photos, Floor Plans, Apartments, Sales Mode, Details, Energy, Expose, Listings) and NO indication of what to do next or in what order.

Fix: Continue the wizard OR show a step-by-step checklist that guides the user through the remaining setup.

**2. Photos don't cascade to apartments**
Building photos exist (9/6 shown) but each apartment shows "0/6 photos" with a warning. The user has to manually go into each apartment and re-upload photos.

Fix: Auto-share building photos to all apartments. Offer "Use building photos for all apartments" button.

**3. Listing creation starts empty**
When clicking "CREATE AN AD" on an apartment, the listing editor opens with no title, no description, no price — even though the property data exists. The user has to click "Calculate Price" and "AI Generate" manually for each apartment.

Fix: Auto-generate title + description + price when creating a listing from a property that has complete data.

**4. Energy certificate not copied to apartments**
Parent MFH has energy cert (B, 70.2 kWh, Gas) but apartment detail shows "Energy certificate ○" (empty). This is the SAME building — the energy cert should be shared.

Fix: Auto-copy energy cert from parent to all child units on creation.

---

### MODERATE — Confusing but navigable

**5. "Apartments (0)" but shows 3 apartments below**
The section header count doesn't match the content. Likely a rendering bug or the count queries differently.

**6. Sales mode section is BELOW apartments**
The user should decide HOW to sell (individual/bundle/both) BEFORE creating individual apartment listings. Currently:
- Create apartments → scroll down → select sales mode → scroll back up → create listings

Fix: Move sales mode selection to RIGHT AFTER apartment creation, or include it in the wizard.

**7. Per-apartment price not pre-calculated**
Each apartment listing needs its own price, but the pricing engine only runs once for the whole building. The user has to click "CALCULATE PRICE" in each listing separately.

Fix: Auto-calculate pricing for each apartment based on its size when creating the listing.

**8. Address shows "Saga 12" instead of actual street**
The street name appears truncated or wrongly entered. Could be a form validation or data persistence issue.

**9. Status sidebar doesn't reflect full journey**
Shows 5 items but the actual journey is:
Property → Energy → Photos → Floor Plans → Apartments → Per-unit Photos → Per-unit Floor Plans → Sales Mode → Listings → Pricing → Description → Publish → IS24

---

### MINOR — Polish

**10. Equipment tags inconsistent capitalization**
"balcony" vs "Garden" vs "Parking space" — should be consistent.

**11. "EXAMINATION" step label unclear**
Should be "Zusammenfassung" (Summary) or "Überprüfung" (Review).

**12. No photo reordering**
Can upload photos but can't drag to reorder them (title photo should be first).

**13. Mix of English and German**
Some labels appear in English (Google Translate artifact but also some actual English in the code).

---

## Recommended Optimal Flow

### Phase 1: Property Wizard (already good — keep it)
```
Step 1: Type & Address
Step 2: Details (rooms, area, condition, features)
       → If MFH: show "How many apartments?" field
Step 3: Energy Certificate
Step 4: Review & Save
```

### Phase 2: Media Upload (NEW — guided continuation)
```
Step 5: "Upload Building Photos" (min 6, drag-drop)
        → Progress bar, instant feedback
Step 6: "Upload Floor Plans" (optional)
        → Accept PDF/images
```

### Phase 3: Apartments (only for MFH — NEW guided flow)
```
Step 7: Quick apartment creator
        → Show all apartments in a table/cards
        → Pre-fill: address, condition, energy from parent
        → Fields per unit: Label, Area, Rooms, Baths, Floor
        → "Add another" button
        
Step 8: Per-apartment media
        → "Use building photos for all?" [Yes / Upload separate]
        → If separate: upload per apartment
        → Floor plans per apartment

Step 9: Sales Mode
        → Individual / Bundle / Both
        → Show what this means (visual explanation)
```

### Phase 4: Listing Creation (auto-triggered)
```
Step 10: Auto-create listings based on sales mode
         → Bundle mode: 1 listing for the whole MFH
         → Individual mode: 1 listing per apartment
         → Both: all of the above
         
Step 11: For each listing (auto-fill):
         → Auto-calculate price per unit (proportional to area)
         → Auto-generate AI description per unit
         → Pre-fill title: "[Type], [Rooms] Zimmer, [Area] m², [City]"
         
Step 12: Review all listings on ONE page
         → Side-by-side comparison
         → Edit any listing inline
         
Step 13: Publish
         → Compliance check (all green?)
         → Payment (EUR 999 per listing? or per property?)
         → One-click publish all
```

### Phase 5: Portal Syndication (after publish)
```
Step 14: "Publish to IS24?" prompt
         → Auto-publish all active listings
         → Show syndication status
```

---

## Key Architectural Changes Needed

### 1. Post-Save Wizard
Instead of dumping the user on the property detail page, continue the wizard:
```
[Property Saved!]
    ↓
[Upload Photos] → [Floor Plans] → [Add Apartments] → [Sales Mode] → [Create Listings]
    ↓
[All Done! View your property]
```

### 2. Auto-cascade Data
When creating child units from a parent MFH:
- Copy: address, energy cert, condition, attributes
- Share: building photos (unless unit-specific uploaded)
- Calculate: per-unit price (proportional to area)
- Generate: per-unit description

### 3. Batch Listing Creation
When sales mode is selected, auto-create all required listings:
- Pre-fill everything that can be derived
- Show a review page with ALL listings
- One "Publish All" button

### 4. Smart Status Tracker
Replace the current 5-item status sidebar with a complete journey tracker:
```
✓ Property saved
✓ Energy certificate
✓ Photos (9/6)
✓ Floor plans (2)
✓ Apartments (3 WE)
○ Per-unit photos
✓ Sales mode (Both)
○ Package listing
○ Unit listings (0/3)
○ Published
○ IS24 syndicated
```

---

## Priority Implementation Order

1. **Auto-copy energy cert + photos to apartments** (30 min)
2. **Auto-generate listing title + price when creating from property** (1 hr)
3. **Post-save guided checklist** (2 hr)
4. **Batch listing creation on sales mode selection** (2 hr)
5. **Post-save wizard continuation** (4 hr)
6. **Review all listings page** (3 hr)
