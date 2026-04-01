import { CONSTANTS } from "../config/constants.js";

const generateOTP = () => {
    const length = CONSTANTS.OTP.LENGTH;

    if (CONSTANTS.OTP.TESTING) {
        return Number("123456789".substring(0, length));
    }

    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1));
}

export default generateOTP;