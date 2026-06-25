import type { Asset } from "react-native-image-picker";
import { isIndividualMemberType } from "../utils/memberType";

export type MemberTypeSelection = {
    member_type_id: string;
    member_type_name: string;
};

export type MemberPersonalInfo = {
    member_type_id: string;
    member_type_name: string;
    first_name: string;
    last_name: string;
    other_names: string;
    id_no: string;
    gender: string;
    marital_status: string;
    date_of_birth: string;
    birth_city: string;
    primary_phone: string;
    secondary_phone: string;
    email: string;
    tax_number: string;
    id_date_of_issue: string;
    title: string;
};

export type MemberFarmInfo = {
    route_id: string;
    route_name?: string;
    center_id?: string;
    center_name?: string;
    member_no: string;
    number_of_cows: string;
};

export type MemberBankingInfo = {
    bank_id: string;
    bank_name?: string;
    bank_branch: string;
    account_no: string;
    account_name: string;
};

export type MemberContactsInfo = {
    primary_phone: string;
    secondary_phone: string;
    email: string;
};

export type MemberContactsStepData = MemberContactsInfo & {
    next_of_kins: MemberNextOfKinInfo[];
};

export const EMPTY_MEMBER_CONTACTS: MemberContactsInfo = {
    primary_phone: "",
    secondary_phone: "",
    email: "",
};

export type MemberNextOfKinInfo = {
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

export const NEXT_OF_KIN_RELATIONSHIPS = [
    "SPOUSE",
    "FATHER",
    "MOTHER",
    "BROTHER",
    "SISTER",
    "CHILD",
    "GUARDIAN",
    "FRIEND",
    "OTHER",
] as const;

export const createEmptyNextOfKin = (isPrimary = false): MemberNextOfKinInfo => ({
    full_name: "",
    relationship: "",
    phone_number: "",
    alternative_phone_number: "",
    email_address: "",
    national_id_no: "",
    postal_address: "",
    physical_address: "",
    occupation: "",
    is_primary: isPrimary,
    status: true,
    remarks: "",
});

export type MemberPhotoUploads = {
    id_front_photo: Asset | null;
    id_back_photo: Asset | null;
    passport_photo: Asset | null;
};

export type MemberRegistrationData = {
    member_type: MemberTypeSelection;
    personal: MemberPersonalInfo;
    farm: MemberFarmInfo;
    banking: MemberBankingInfo;
    next_of_kins: MemberNextOfKinInfo[];
    photos: MemberPhotoUploads;
};

export const EMPTY_MEMBER_REGISTRATION: MemberRegistrationData = {
    member_type: {
        member_type_id: "",
        member_type_name: "",
    },
    personal: {
        member_type_id: "",
        member_type_name: "",
        first_name: "",
        last_name: "",
        other_names: "",
        id_no: "",
        gender: "",
        marital_status: "",
        date_of_birth: "",
        birth_city: "",
        primary_phone: "",
        secondary_phone: "",
        email: "",
        tax_number: "",
        id_date_of_issue: "",
        title: "",
    },
    farm: {
        route_id: "",
        route_name: "",
        center_id: "",
        center_name: "",
        member_no: "",
        number_of_cows: "",
    },
    banking: {
        bank_id: "",
        bank_name: "",
        bank_branch: "",
        account_no: "",
        account_name: "",
    },
    next_of_kins: [createEmptyNextOfKin(true)],
    photos: {
        id_front_photo: null,
        id_back_photo: null,
        passport_photo: null,
    },
};

/** Strip person-only personal fields when registering a non-individual member. */
export function sanitizePersonalForMemberType(
    personal: MemberPersonalInfo,
    memberTypeName?: string
): MemberPersonalInfo {
    if (isIndividualMemberType(memberTypeName || personal.member_type_name)) {
        return personal;
    }

    return {
        ...personal,
        last_name: "",
        other_names: "",
        id_no: "",
        gender: "",
        marital_status: "",
        date_of_birth: "",
        id_date_of_issue: "",
        title: "",
    };
}

export function sanitizePhotosForMemberType(
    photos: MemberPhotoUploads,
    memberTypeName?: string
): MemberPhotoUploads {
    if (isIndividualMemberType(memberTypeName)) {
        return photos;
    }

    return {
        id_front_photo: null,
        id_back_photo: null,
        passport_photo: photos.passport_photo,
    };
}

export function sanitizeNextOfKinsForMemberType(
    nextOfKins: MemberNextOfKinInfo[],
    memberTypeName?: string
): MemberNextOfKinInfo[] {
    if (isIndividualMemberType(memberTypeName)) {
        return nextOfKins;
    }

    return [];
}
