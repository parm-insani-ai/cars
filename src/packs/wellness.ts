import type { Pack } from "./types";

const standardShift = () =>
  [2, 3, 4, 5, 6].map(d => ({ dayOfWeek: d, startMin: 10 * 60, endMin: 19 * 60 }));

export const wellnessPack: Pack = {
  vertical: "wellness",
  defaultGreeting: (name) => `Thanks for calling ${name} — happy to help you book today.`,
  defaultPersonality: `Calm, gracious, professional. Speak the way a great receptionist at a high-end spa does: unhurried, attentive, never robotic. Confirm details twice. If the caller asks for a specific provider by name, find them; otherwise gently suggest the next available.`,
  services: [
    { name: "60-min Swedish massage", category: "massage", durationMin: 60, priceUsd: 120, providerKind: "massage_therapist", description: "Relaxation massage. Wear comfortable clothing." },
    { name: "90-min Deep tissue massage", category: "massage", durationMin: 90, priceUsd: 170, providerKind: "massage_therapist", description: "Therapeutic, firm pressure. Communicate pressure preferences with your therapist." },
    { name: "Signature facial", category: "facial", durationMin: 60, priceUsd: 145, providerKind: "esthetician", description: "Cleanse, exfoliate, mask, hydrate. New clients: arrive 10 minutes early for intake." },
    { name: "Haircut", category: "salon", durationMin: 45, priceUsd: 65, providerKind: "stylist", description: "Cut and finish. Color is booked separately." },
    { name: "Color (root touch-up)", category: "salon", durationMin: 90, priceUsd: 130, providerKind: "stylist", description: "Single-process root color. Patch test required for new clients." },
    { name: "Adjustment", category: "chiro", durationMin: 30, priceUsd: 95, providerKind: "chiropractor", description: "Standard chiropractic adjustment. New patients require an exam first." },
    { name: "New patient exam", category: "chiro", durationMin: 60, priceUsd: 145, providerKind: "chiropractor", description: "Required before any adjustment for new patients. Includes consultation and posture assessment." },
  ],
  providers: [
    { name: "Sara K. (LMT)", kind: "massage_therapist", shifts: standardShift() },
    { name: "Jordan P. (LMT)", kind: "massage_therapist", shifts: standardShift() },
    { name: "Mia L. (Esthetician)", kind: "esthetician", shifts: standardShift() },
    { name: "Riley B. (Stylist)", kind: "stylist", shifts: standardShift() },
    { name: "Dr. Tanaka (DC)", kind: "chiropractor", shifts: standardShift() },
  ],
  knowledge: [
    { title: "Cancellation policy", body: "We charge 50% of the service fee for cancellations made within 24 hours, and 100% for no-shows.", tags: ["policy"] },
    { title: "Gift cards", body: "Yes, we sell gift cards in any amount — online or in-person. Online cards arrive by email within 5 minutes.", tags: ["gift"] },
    { title: "Late arrivals", body: "If you're more than 15 minutes late, we may have to shorten your service or reschedule to be fair to clients after you.", tags: ["policy"] },
    { title: "First visit", body: "Plan to arrive 10 minutes early for intake forms. We'll text you a link to fill them out beforehand if you prefer.", tags: ["first visit"] },
    { title: "Parking", body: "Free 90-minute street parking on the block. The garage on the corner validates with us — bring your ticket inside.", tags: ["parking"] },
  ],
  followUpPolicy: {
    preApptReminderHoursBefore: 24,
    noShowRecoveryMinutesAfter: 15,
    missedCallCallbackMinutesAfter: 5,
    firstCallFollowupHoursAfter: null,
  },
};
