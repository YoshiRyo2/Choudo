# Nimbus: Measurement-based outfit fit app

**Team:** Ryo, Derek

---

## Problem

Online shoppers get two things wrong when buying clothes:

1. **Fit.** Size charts don't tell you how a garment will fit your body, so people guess and return items.
2. **Outfits.** Combining pieces from different brands means checking each one separately.

Nimbus lets people enter their body measurements once, then swipe through clothes from different brands and see how each one fits their body.

Existing try-on tools like ChatGPT or Google often rely on camera or face photos. Nimbus does not require a face or camera, so users can check fit without sharing their image.

## Open question

How accurate can size predictions be, given that brand measurements vary and garments stretch?

## Users

Anyone shopping for clothes online who wants to know how a size will fit before they order.

## v1 scope

- One category: crew-neck tees
- Three brands: [brand 1], [brand 2], [brand 3]
- Seven body measurements: height, chest, waist, hips, shoulder width, sleeve length, inseam
- Guest mode only, with data stored on the device
- Size comparison with a confidence label

## Non-goals for v1

- Photos, camera, or AR
- User accounts
- Categories beyond tees
- Automated scraping of brand sites

## Success criteria

- Predictions match ten testers' real fits at least [80]% of the time for one brand and one category.
- At least [eight] of ten testers say they'd use it again for a real purchase.

## Status

Planning. See the [scope document](link) and the [issues](link) for the phase plan.

## Getting started

[Setup instructions go here once the project has code.]