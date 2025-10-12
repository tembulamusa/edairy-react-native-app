import { Alert } from "react-native";
import { getItem } from "./local-storage";

const BASE_URL = "http://10.0.2.2:8000/api/";

const makeRequest = async ({
    url,
    method,
    data = null,
    use_jwt = false,
    responseType = "json",
    isFormData = false,
}) => {
    url = BASE_URL + url;

    let headers: any = {
        accept: "application/json",
    };

    if (!isFormData) {
        headers["content-type"] = "application/json";
    }

    const user = await getItem("user");
    const token = user?.access_token;
    // Alert.alert(token);
    // if (use_jwt && token) {
    headers.Authorization = `Bearer ${token}`;
    // }

    try {
        const request: any = {
            method,
            headers,
        };

        if (data) {
            request.body = isFormData ? data : JSON.stringify(data);
        }

        const response = await fetch(url, request);

        let result;
        try {
            result =
                responseType === "text"
                    ? await response.text()
                    : await response.json();
        } catch {
            result = {};
        }

        return [response.status, result];
    } catch (err: any) {
        console.error("Fetch error:", err);
        Alert.alert("Network Error", "Please check your internet connection.");
        return [500, { message: "Network error" }];
    }
};

export default makeRequest;
