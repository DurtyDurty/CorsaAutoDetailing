"use server";

import { business } from "@/config/business";
import { intake, baseLead, type IntakeResult } from "@/lib/leads/intake";
import { getLeadStore } from "@/lib/leads/store";
import { photosEnabled, storeLeadPhotos } from "@/lib/photos";
import { computeEstimate } from "@/lib/pricing";
import { lookupZip } from "@/lib/zip";
import {
  contactSchema,
  launchListSchema,
  membershipInterestSchema,
  quoteRequestSchema,
} from "@/lib/validation";

export type FormResult = IntakeResult & { redirectTo?: string };

export async function submitLaunchList(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const result = await intake({
    leadType: "launch_list",
    schema: launchListSchema,
    formData,
    build: (d) => ({
      ...baseLead("launch_list", d),
      phone: d.phone,
      zip: d.zip,
      zipEligibility: lookupZip(d.zip).eligibility,
      vehicleCategory: d.vehicleCategory,
      serviceId: d.serviceId,
      preferredContact: d.preferredContact,
    }),
  });
  return withRedirect(result, "launch-list");
}

export async function submitContact(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const result = await intake({
    leadType: "contact",
    schema: contactSchema,
    formData,
    build: (d) => ({
      ...baseLead("contact", d),
      phone: d.phone,
      message: d.message,
    }),
  });
  return withRedirect(result, "contact");
}

export async function submitMembershipInterest(
  _prev: FormResult | null,
  formData: FormData,
): Promise<FormResult> {
  if (!business.membership.enabled) {
    return { status: "unavailable", message: "Maintenance plans are not open for interest right now." };
  }
  const result = await intake({
    leadType: "membership_interest",
    schema: membershipInterestSchema,
    formData,
    build: (d) => ({
      ...baseLead("membership_interest", d),
      zip: d.zip,
      zipEligibility: lookupZip(d.zip).eligibility,
      vehicleCategory: d.vehicleCategory,
      membershipCadence: d.cadence,
      futureInterests: d.futureInterests,
      notes: d.notes,
    }),
  });
  return withRedirect(result, "membership");
}

export async function submitQuoteRequest(_prev: FormResult | null, formData: FormData): Promise<FormResult> {
  const result = await intake({
    leadType: "quote_request",
    schema: quoteRequestSchema,
    formData,
    build: (d) => ({
      ...baseLead("quote_request", d),
      lastName: d.lastName,
      phone: d.phone,
      preferredContact: d.preferredContact,
      vehicleCategory: d.vehicleCategory,
      vehicleYear: d.vehicleYear,
      vehicleMake: d.vehicleMake,
      vehicleModel: d.vehicleModel,
      serviceId: d.serviceId,
      condition: d.condition,
      conditionFlags: d.conditionFlags,
      concerns: d.concerns,
      zip: d.zip,
      zipEligibility: lookupZip(d.zip).eligibility,
      city: d.city,
      locationType: d.locationType,
      timeWindows: d.timeWindows,
      preferredDate: d.preferredDate,
      notes: d.notes,
      estimate: computeEstimate({
        serviceId: d.serviceId,
        vehicleCategoryId: d.vehicleCategory,
        condition: d.condition,
        conditionFlags: d.conditionFlags,
      }),
    }),
    afterSave: async (lead, fd) => {
      if (!photosEnabled()) return;
      const files = fd.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length === 0) return;
      const { refs } = await storeLeadPhotos(lead.id, files);
      if (refs.length > 0) {
        const store = await getLeadStore();
        await store?.updateLead(lead.id, { photoRefs: refs });
      }
    },
  });
  return withRedirect(result, "request");
}

function withRedirect(result: IntakeResult, kind: string): FormResult {
  if (result.status !== "ok") return result;
  return { ...result, redirectTo: `/thanks/${kind}?ref=${encodeURIComponent(result.leadId)}` };
}
