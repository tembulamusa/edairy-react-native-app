import AsyncStorage from "@react-native-async-storage/async-storage";
import makeRequest from "./makeRequest"; // adjust import path

// We add filters accordingly
const fetchCommonData = async (
    { name }: { name: string },
    search?: string
) => {
    try {
        const raw = await AsyncStorage.getItem("commonData");
        let parsed = raw ? JSON.parse(raw) : {};

        if (!parsed[name]) {
            const [status, response] = await makeRequest({
                url: `common-data?name=${name}`,
                method: "GET",
            });

            if (![200, 201].includes(status)) {
                throw new Error(response?.message || "Failed to fetch common data");
            }

            parsed = { ...parsed, [name]: response };

            await AsyncStorage.setItem("commonData", JSON.stringify(parsed));
        }

        let result = parsed[name];

        if (search && Array.isArray(result)) {
            const searchLower = search.toLowerCase();
            result = result.filter((item: any) =>
                Object.values(item).some((val) =>
                    String(val).toLowerCase().includes(searchLower)
                )
            );
        }
        return result;
    } catch (error) {
        console.error(`❌ Failed to load common data for ${name}:`, error);
        throw error;
    }
};

export default fetchCommonData;
