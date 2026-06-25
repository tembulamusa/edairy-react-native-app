/** Keywords that indicate a non-person member type (school, company, etc.). */
const NON_INDIVIDUAL_KEYWORDS = [
    "institution",
    "company",
    "organization",
    "organisation",
    "school",
    "sacco",
    "group",
    "church",
    "cooperative",
    "co-operative",
    "society",
    "trust",
    "foundation",
    "ngo",
    "business",
    "firm",
    "corporate",
    "partnership",
    "limited",
    "ltd",
];

/** True when the member type is a person (e.g. Individual) — uses first + last name. */
export function isIndividualMemberType(memberTypeName?: string): boolean {
    if (!memberTypeName) return true;
    const normalized = memberTypeName.trim().toLowerCase();
    if (NON_INDIVIDUAL_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
        return false;
    }
    return normalized.includes("individual") || normalized === "farmer";
}

export function getMemberPrimaryNameLabel(memberTypeName?: string): string {
    return isIndividualMemberType(memberTypeName) ? "First Name" : "Name";
}

export function getMemberPrimaryNamePlaceholder(memberTypeName?: string): string {
    return isIndividualMemberType(memberTypeName)
        ? "First name"
        : "School or organization name";
}

export function getPersonalInfoStepTitle(memberTypeName?: string): string {
    return isIndividualMemberType(memberTypeName) ? "Personal Info" : "Organization Info";
}

import fetchCommonData from "../components/utils/fetchCommonData";

export type MemberTypeRecord = {
    id: number;
    name: string;
    description?: string;
};

/** Load member types from GET /member-types. */
export async function fetchMemberTypes(): Promise<MemberTypeRecord[]> {
    const types = await fetchCommonData({
        name: "member-types",
        direct: true,
        cachable: true,
        logContext: "MemberRegistration",
    });

    return (Array.isArray(types) ? types : [])
        .filter((type) => type?.id != null && type?.name)
        .map((type) => ({
            id: Number(type.id),
            name: String(type.name),
            description: type.description ? String(type.description) : undefined,
        }));
}
