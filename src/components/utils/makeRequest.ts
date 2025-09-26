import { Alert } from "react-native";
import { getItem } from "./local-storage";

const BASE_URL = "http://192.168.100.18:8000/api/";

const makeRequest = async ({
    url,
    method,
    data = null,
    use_jwt = false,
    responseType = "json",
    isFormData = false, // 👈 flag for form data
}) => {
    url = BASE_URL + url;

    let headers: any = {
        accept: "application/json",
    };

    // only set JSON content-type if not formdata
    if (!isFormData) {
        headers["content-type"] = "application/json";
    }

    // 👇 fetch user from AsyncStorage
    const user = await getItem("user");
    const token = user?.access_token;
    console.log(token);
    if (token) {
        headers = { ...headers, Authorization: `Bearer ${token}` };
    }

    try {
        let request: any = {
            method,
            headers,
        };

        if (data) {
            request.body = isFormData ? data : JSON.stringify(data);
        }

        const response = await fetch(url, request);

        let result;
        if (responseType === "text") {
            result = await response.text();
        } else {
            result = await response.json();
        }

        return [response.status, result];
    } catch (err: any) {
        console.error("Fetch error:", err);
        return [500, { message: "Network error" }];
    }
};
export default makeRequest;