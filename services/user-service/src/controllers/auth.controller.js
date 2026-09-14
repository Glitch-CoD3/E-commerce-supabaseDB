import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import { generate_access_token, generate_refresh_token } from "../utils/token_generator_verify.js";
import { hashPassword, comparePassword } from "../utils/hash_password.js";
// import { sendEmail } from "../utils/email_service_otp_send.js";
import { generateOTP, getOtpHtml } from "../utils/generate_otp.js";
import { send_smtp_Mail  } from "../utils/send_otp_smtp.js"

const userResponse = (user) => ({
    id: Number(user.id),
    full_name: user.fullName,
    email: user.email
});

const registerUser = async (req, res) => {
    try {
        const { name, email, password, phone_number } = req.body;
        if (!name || !email || !password || !phone_number) {
            return res.status(400).json({ message: "All fields are required to register a user" });
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) return res.status(400).json({ message: "User already exists" });

        const user = await prisma.user.create({
            data: {
                fullName: name,
                email,
                passwordHash: await hashPassword(password),
                phoneNumber: phone_number
            }
        });
        const otp = generateOTP();
        await prisma.otp.create({
            data: {
                userId: user.id,
                email,
                otpCodeHash: await bcrypt.hash(otp, 10),
                otpType: "email_verification",
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            }
        });
        // await sendEmail(email, "Your OTP Code", `Your OTP code is: ${otp}`, getOtpHtml(otp));
        await send_smtp_Mail(email, "Your OTP Code", `Your OTP code is: ${otp}`, getOtpHtml(otp));

        return res.status(201).json({ message: "User created successfully", user: userResponse(user) });
    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ message: "Internal server error from registerUser" });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ message: "Email and password are required." });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.status(400).json({ message: "User not registered." });
        if (!await comparePassword(password, user.passwordHash)) {
            return res.status(400).json({ message: "Invalid credentials." });
        }
        if (!user.isVerified) return res.status(400).json({ message: "Please verify your email first." });

        const session = await prisma.userSession.create({
            data: {
                userId: user.id,
                roleId: String(user.roleId),
                refreshTokenHash: "",
                ipAddress: req.ip,
                userAgent: req.headers["user-agent"]
            }
        });
        const sessionId = Number(session.id);
        const access_token = generate_access_token({
            id: Number(user.id), role_id: Number(user.roleId),
            full_name: user.fullName, email: user.email
        });
        const refresh_token = generate_refresh_token({
            id: Number(user.id), role_id: Number(user.roleId), session_id: sessionId
        });
        await prisma.userSession.update({
            where: { id: session.id },
            data: { refreshTokenHash: await bcrypt.hash(refresh_token, 10) }
        });

        res.cookie("refreshToken", refresh_token, {
            httpOnly: true, secure: true, sameSite: "Strict", maxAge: 7 * 24 * 60 * 60 * 1000
        });
        return res.status(200).json({
            message: "Login successful.", session_id: sessionId, accessToken: access_token,
            user: userResponse(user)
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error." });
    }
};

const OTP_verification = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required!" });
        const record = await prisma.otp.findFirst({ where: { email, otpType: "email_verification" } });
        if (!record) return res.status(400).json({ message: "Invalid OTP" });
        if (record.expiresAt < new Date()) return res.status(400).json({ message: "OTP has expired" });
        if (!await bcrypt.compare(otp, record.otpCodeHash)) return res.status(400).json({ message: "Invalid OTP" });

        await prisma.$transaction([
            prisma.user.update({ where: { email }, data: { isVerified: true, status: "active" } }),
            prisma.otp.deleteMany({ where: { email } })
        ]);
        return res.status(200).json({ success: true, message: "Email verified successfully" });
    } catch (error) {
        console.error("Server Error From Verification:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

const resend_otp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required." });
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!user) return res.status(404).json({ message: "User not found." });
        await prisma.otp.deleteMany({ where: { email, otpType: "email_verification" } });
        const otp = generateOTP();
        await prisma.otp.create({
            data: {
                userId: user.id, email, otpCodeHash: await bcrypt.hash(otp, 10),
                otpType: "email_verification", expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            }
        });
        await sendEmail(email, "Your OTP Code", `Your OTP code is: ${otp}`, getOtpHtml(otp));
        return res.status(200).json({ success: true, message: "A new verification OTP has been sent." });
    } catch (error) {
        console.error("Resend OTP Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const verify_resend_OTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ message: "Email and OTP are required." });
        const otpData = await prisma.otp.findFirst({ where: { email, otpType: "email_verification" } });
        if (!otpData) return res.status(400).json({ message: "OTP not found." });
        if (new Date() > otpData.expiresAt) return res.status(400).json({ message: "OTP expired." });
        if (!await bcrypt.compare(otp, otpData.otpCodeHash)) return res.status(400).json({ message: "Invalid OTP." });
        await prisma.$transaction([
            prisma.user.updateMany({
                where: { email, isVerified: false, status: "inactive" },
                data: { isVerified: true, status: "active" }
            }),
            prisma.otp.delete({ where: { id: otpData.id } })
        ]);
        return res.status(200).json({ success: true, message: "OTP verified." });
    } catch (error) {
        console.error("Verify Reset OTP Error:", error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const log_out = async (req, res) => {
    try {
        const session_id = req.user.session_id;
        const session = await prisma.userSession.findFirst({ where: { id: BigInt(session_id), revoked: false } });
        if (!session) return res.status(401).json({ message: "Session not found or revoked" });
        await prisma.userSession.update({ where: { id: session.id }, data: { revoked: true } });
        res.clearCookie("refreshToken");
        return res.status(200).json({ session_id, success: "success", message: "Logout Successfully" });
    } catch (error) {
        console.error("Logout error ", error);
        return res.status(401).json({ message: "Unauthorized for logout" });
    }
};

const logout_all_devices = async (req, res) => {
    try {
        const user_id = req.user?.id;
        if (!user_id) return res.status(401).json({ message: "Unauthorized user request" });
        const result = await prisma.userSession.updateMany({
            where: { userId: BigInt(user_id), revoked: false }, data: { revoked: true }
        });
        if (result.count === 0) return res.status(404).json({ message: "No active sessions found" });
        res.clearCookie("refreshToken");
        return res.status(200).json({ success: true, message: "Logged out from all devices successfully" });
    } catch (error) {
        console.error("Logout all devices error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const refresh = async (req, res) => {
    try {
        const user = req.user;
        const session = await prisma.userSession.findFirst({ where: { userId: BigInt(user.id), revoked: false } });
        if (!session) return res.status(401).json({ message: "Invalid token" });
        const refresh_token = generate_refresh_token(user.id, user.name, user.email, user.role_id);
        await prisma.userSession.update({
            where: { id: session.id }, data: { refreshTokenHash: await bcrypt.hash(refresh_token, 10) }
        });
        const access_token = generate_access_token(user.id, user.name, user.email, user.role_id);
        res.cookie("refreshToken", refresh_token, {
            httpOnly: true, secure: false, sameSite: "Strict", maxAge: 15 * 60 * 1000
        });
        return res.status(201).json({ session_id: Number(session.id), message: "Tokens are refreshed", access_token });
    } catch (error) {
        console.error("Error refreshing token:", error);
        return res.status(500).json({ message: "Internal server error from refresh" });
    }
};

const get_me = async (req, res) => {
    try {
        const user_id = req.user?.id;
        if (!user_id) return res.status(401).json({ message: "Unauthorized user request" });
        const user = await prisma.user.findUnique({
            where: { id: BigInt(user_id) }, select: { id: true, fullName: true, email: true, phoneNumber: true }
        });
        if (!user) return res.status(401).json({ message: "User no Found" });
        return res.status(200).json({
            success: "success",
            user: { id: Number(user.id), full_name: user.fullName, email: user.email, phone_number: user.phoneNumber }
        });
    } catch (error) {
        console.error("Internal server Error", error);
        return res.status(500).json({ message: "Internel server Error From get_me Controller" });
    }
};

const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ message: "User id is required" });
        const user = await prisma.user.findUnique({
            where: { id: BigInt(id) }, select: { fullName: true, email: true, phoneNumber: true }
        });
        if (!user) return res.status(404).json({ message: "User not Found" });
        return res.status(200).json({
            success: "success", user: { full_name: user.fullName, email: user.email, phone_number: user.phoneNumber }
        });
    } catch (error) {
        console.error("Internal server Error", error);
        return res.status(500).json({ message: "Internel server Error From getUserById Controller" });
    }
};

const forgot_password = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });
        const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!user) return res.status(200).json({
            success: true, message: "If a user with that email exists, a password reset OTP has been sent."
        });
        const otp = generateOTP();
        await prisma.otp.create({
            data: {
                userId: user.id, email, otpCodeHash: await bcrypt.hash(otp, 10),
                otpType: "reset_password", expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            }
        });
        await sendEmail(email, "Your OTP Code", `Your OTP code is: ${otp}`, getOtpHtml(otp));
        return res.status(200).json({
            success: true, message: "If a user with that email exists, a password reset OTP has been sent."
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server Error" });
    }
};

const reset_password = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        const user = await prisma.user.findFirst({ where: { email, isVerified: true } });
        if (!user) return res.status(401).json({ message: "User not verified" });
        await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(newPassword, 10) } });
        return res.json({ message: "Password reset successfully." });
    } catch (error) {
        console.error("reset password error: ", error);
        return res.status(500).json({ Error: "Error From reset_password controller" });
    }
};

export {
    registerUser, resend_otp, loginUser, refresh,
    OTP_verification, verify_resend_OTP, log_out, get_me,
    logout_all_devices, forgot_password, reset_password,
    getUserById
};
