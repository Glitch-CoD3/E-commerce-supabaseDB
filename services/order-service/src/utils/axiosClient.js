import axios from "axios";

const getAllCart = async (token) => {

    try {
        const response = await axios.get(
            `${process.env.CART_SERVICE_URL}/api/v1/cart`,
            {
                headers: {
                    Cookie: `refreshToken=${token}`,
                }
            }
        );

        return response.data;

    } catch (error) {
        console.log("Axios Error:");

        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Data:", error.response.data);
        } else {
            console.log(error.message);
        }

        throw error;
    }
};


const ClearCart = async (token) => {
    try {
        const response = await axios.delete(
            `${process.env.CART_SERVICE_URL}/api/v1/cart`,
            {
                headers: {
                    Cookie: `refreshToken=${token}`,
                },
            }
        );

        return response.data;
    } catch (error) {
        console.log("Axios Error (ClearCart):");

        if (error.response) {
            console.log("Status:", error.response.status);
            console.log("Data:", error.response.data);
        } else {
            console.log(error.message);
        }

        throw error;
    }
};

export { getAllCart, ClearCart };