export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
    const email = normalizeEmail(value);
    return email.length > 0 && email.includes("@");
}

export function buildEmailLoginPayload(
    email: string,
    password: string
): { email: string; password: string } {
    return {
        email: normalizeEmail(email),
        password,
    };
}

export function extractAuthToken(response: any): string | null {
    if (!response || typeof response !== "object") {
        return null;
    }

    return (
        response.token ||
        response.access_token ||
        response.data?.token ||
        response.data?.access_token ||
        null
    );
}

export function extractLoginErrorMessage(response: any, status?: number): string {
    if (!response || typeof response !== "object") {
        return status ? `Request failed with status ${status}` : "Login failed";
    }

    return (
        response.error ||
        response.message ||
        response.data?.error ||
        response.data?.message ||
        (status ? `Request failed with status ${status}` : "Login failed")
    );
}

export function getPrimaryPhoneForStorage(userData?: any): string {
    return (
        userData?.member_details?.primary_phone ||
        userData?.primary_phone ||
        userData?.phone_number ||
        ""
    );
}
