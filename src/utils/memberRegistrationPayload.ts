import type { MemberRegistrationData, MemberNextOfKinInfo } from "../types/memberRegistration";
import {
    sanitizeNextOfKinsForMemberType,
    sanitizePersonalForMemberType,
    sanitizePhotosForMemberType,
} from "../types/memberRegistration";
import { appendReactNativeFormFile } from "./reactNativeFormData";
import { toPositiveIntString } from "./dropdownItems";
import { isIndividualMemberType } from "./memberType";

function appendField(
    formData: FormData,
    key: string,
    value: string | number | boolean | null | undefined,
    options: { skipEmpty?: boolean } = {}
) {
    if (typeof value === "function" || (typeof value === "object" && value !== null && !(value instanceof Date))) {
        return;
    }

    if (value === null || value === undefined) {
        if (!options.skipEmpty) {
            formData.append(key, "");
        }
        return;
    }

    if (typeof value === "boolean") {
        formData.append(key, value ? "true" : "false");
        return;
    }

    const text = String(value).trim();
    if (options.skipEmpty && text === "") {
        return;
    }

    formData.append(key, text);
}

export type NextOfKinApiRecord = {
    member_id: number;
    full_name: string;
    relationship: string;
    phone_number: string;
    alternative_phone_number: string;
    email_address: string;
    national_id_no: string;
    postal_address: string;
    physical_address: string;
    occupation: string;
    is_primary: boolean;
    status: boolean;
    remarks: string;
};

type NextOfKinFieldBinding = {
    snake: keyof NextOfKinApiRecord;
    pascal: string[];
    jsonPascal: string;
};

/** Matches web member create multipart binding (snake_case + PascalCase + bracket keys). */
const NEXT_OF_KIN_FIELD_BINDINGS: NextOfKinFieldBinding[] = [
    { snake: "member_id", pascal: ["MemberId", "MemberID"], jsonPascal: "MemberID" },
    { snake: "full_name", pascal: ["FullName"], jsonPascal: "FullName" },
    { snake: "relationship", pascal: ["Relationship"], jsonPascal: "Relationship" },
    { snake: "phone_number", pascal: ["PhoneNumber"], jsonPascal: "PhoneNumber" },
    {
        snake: "alternative_phone_number",
        pascal: ["AlternativePhoneNumber"],
        jsonPascal: "AlternativePhoneNumber",
    },
    { snake: "email_address", pascal: ["EmailAddress"], jsonPascal: "EmailAddress" },
    { snake: "national_id_no", pascal: ["NationalIdNo", "NationalIDNo"], jsonPascal: "NationalIDNo" },
    { snake: "postal_address", pascal: ["PostalAddress"], jsonPascal: "PostalAddress" },
    { snake: "physical_address", pascal: ["PhysicalAddress"], jsonPascal: "PhysicalAddress" },
    { snake: "occupation", pascal: ["Occupation"], jsonPascal: "Occupation" },
    { snake: "is_primary", pascal: ["IsPrimary"], jsonPascal: "IsPrimary" },
    { snake: "status", pascal: ["Status"], jsonPascal: "Status" },
    { snake: "remarks", pascal: ["Remarks"], jsonPascal: "Remarks" },
];

function buildNextOfKinRecord(kin: MemberNextOfKinInfo, isPrimary: boolean): NextOfKinApiRecord {
    return {
        member_id: 0,
        full_name: kin.full_name.trim(),
        relationship: kin.relationship.trim().toUpperCase(),
        phone_number: kin.phone_number.trim(),
        alternative_phone_number: kin.alternative_phone_number.trim(),
        email_address: kin.email_address.trim(),
        national_id_no: kin.national_id_no.trim(),
        postal_address: kin.postal_address.trim(),
        physical_address: kin.physical_address.trim(),
        occupation: kin.occupation.trim(),
        is_primary: isPrimary,
        status: kin.status !== false,
        remarks: kin.remarks.trim(),
    };
}

function resolvePrimaryIndex(kins: MemberNextOfKinInfo[]): number {
    const flagged = kins.findIndex((kin) => kin.is_primary);
    return flagged >= 0 ? flagged : 0;
}

function buildNextOfKinJsonObject(record: NextOfKinApiRecord): Record<string, string | number | boolean> {
    const payload: Record<string, string | number | boolean> = {};

    NEXT_OF_KIN_FIELD_BINDINGS.forEach(({ snake, jsonPascal }) => {
        const value = record[snake];
        payload[snake] = value;
        payload[jsonPascal] = value;
    });

    return payload;
}

function appendNextOfKinIndexedField(
    formData: FormData,
    index: number,
    binding: NextOfKinFieldBinding,
    value: string | number | boolean
) {
    const prefix = `next_of_kins[${index}]`;
    const keys = new Set<string>([
        `${prefix}.${binding.snake}`,
        `${prefix}[${binding.snake}]`,
        ...binding.pascal.map((pascal) => `${prefix}.${pascal}`),
        ...binding.pascal.map((pascal) => `${prefix}[${pascal}]`),
    ]);

    keys.forEach((key) => appendField(formData, key, value));
}

function buildNextOfKinsFields(formData: FormData, kins: MemberNextOfKinInfo[]) {
    const validKins = kins.filter((kin) => kin.full_name.trim());
    if (validKins.length === 0) {
        return;
    }

    const primaryIndex = resolvePrimaryIndex(validKins);
    const records = validKins.map((kin, index) => buildNextOfKinRecord(kin, index === primaryIndex));

    const primaryRecord = records[primaryIndex] ?? records[0];
    formData.append("next_of_kins", JSON.stringify(buildNextOfKinJsonObject(primaryRecord)));

    records.forEach((record, index) => {
        NEXT_OF_KIN_FIELD_BINDINGS.forEach((binding) => {
            appendNextOfKinIndexedField(formData, index, binding, record[binding.snake]);
        });
    });

    appendField(formData, "next_of_kin_full_name", primaryRecord.full_name);
    appendField(formData, "next_of_kin_phone", primaryRecord.phone_number, { skipEmpty: true });
}

/** Readable key/value pairs from React Native FormData (for debugging). */
export function formDataToDebugEntries(formData: FormData): [string, string][] {
    const parts = (formData as { _parts?: [string, unknown][] })._parts;
    if (!Array.isArray(parts)) {
        return [];
    }

    return parts.map(([key, value]) => {
        if (value != null && typeof value === "object" && "uri" in value) {
            const file = value as { name?: string; uri?: string };
            return [key, `[file: ${file.name || "image"}]`] as [string, string];
        }

        const text = String(value ?? "");
        if (text.length > 160) {
            return [key, `${text.slice(0, 157)}...`] as [string, string];
        }
        return [key, text] as [string, string];
    });
}

export function formatMemberRegistrationPayloadPreview(formData: FormData): string {
    return formDataToDebugEntries(formData)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n");
}

/** Build multipart/form-data for POST members (snake_case fields only). */
export function buildMemberRegistrationFormData(data: MemberRegistrationData): FormData {
    const formData = new FormData();
    const memberTypeName = data.member_type.member_type_name || data.personal.member_type_name;
    const isIndividual = isIndividualMemberType(memberTypeName);
    const personal = sanitizePersonalForMemberType(data.personal, memberTypeName);
    const photos = sanitizePhotosForMemberType(data.photos, memberTypeName);
    const next_of_kins = sanitizeNextOfKinsForMemberType(data.next_of_kins, memberTypeName);
    const { farm, banking } = data;
    const memberTypeId = data.member_type.member_type_id || personal.member_type_id;

    appendField(formData, "member_type_id", toPositiveIntString(memberTypeId) || "3");
    appendField(formData, "first_name", personal.first_name);
    appendField(formData, "route_id", toPositiveIntString(farm.route_id) || "");
    appendField(formData, "member_no", farm.member_no);
    appendField(formData, "primary_phone", personal.primary_phone);
    appendField(formData, "number_of_cows", farm.number_of_cows);

    appendField(formData, "secondary_phone", personal.secondary_phone, { skipEmpty: true });
    appendField(formData, "email", personal.email, { skipEmpty: true });
    appendField(formData, "tax_number", personal.tax_number, { skipEmpty: true });
    appendField(formData, "birth_city", personal.birth_city, { skipEmpty: true });

    if (isIndividual) {
        appendField(formData, "last_name", personal.last_name, { skipEmpty: true });
        appendField(formData, "other_names", personal.other_names, { skipEmpty: true });
        appendField(formData, "id_no", personal.id_no, { skipEmpty: true });
        appendField(formData, "date_of_birth", personal.date_of_birth, { skipEmpty: true });
        appendField(formData, "gender", personal.gender.toUpperCase(), { skipEmpty: true });
        appendField(formData, "marital_status", personal.marital_status.toUpperCase(), { skipEmpty: true });
        appendField(formData, "id_date_of_issue", personal.id_date_of_issue, { skipEmpty: true });
        appendField(formData, "title", personal.title, { skipEmpty: true });
        buildNextOfKinsFields(formData, next_of_kins);
        appendReactNativeFormFile(formData, "id_front_photo", photos.id_front_photo);
        appendReactNativeFormFile(formData, "id_back_photo", photos.id_back_photo);
    }

    appendField(formData, "bank_id", toPositiveIntString(banking.bank_id) || "");
    appendField(formData, "bank_branch", banking.bank_branch);
    appendField(formData, "account_no", banking.account_no);
    appendField(formData, "account_name", banking.account_name);

    appendReactNativeFormFile(formData, "passport_photo", photos.passport_photo);

    return formData;
}
