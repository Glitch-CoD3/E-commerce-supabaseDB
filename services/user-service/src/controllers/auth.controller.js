import prisma from "../config/prisma.js";
import bcrypt from "bcrypt";
import { generate_access_token, generate_refresh_token } from "../utils/token_generator_verify.js";
import { hashPassword, comparePassword } from "../utils/hash_password.js";
// import { sendEmail } from "../utils/email_service_otp_send.js";
import { generateOTP, getOtpHtml } from "../utils/generate_otp.js";
import { send_smtp_Mail } from "../utils/send_otp_smtp.js"

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

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required."
            });
        }

        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(400).json({
                message: "User not registered."
            });
        }

        if (!await comparePassword(password, user.passwordHash)) {
            return res.status(400).json({
                message: "Invalid credentials."
            });
        }

        if (!user.isVerified) {
            return res.status(400).json({
                message: "Please verify your email first."
            });
        }

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

        const access_token = generate_access_token(
            user.id,
            user.fullName,
            user.email,
            user.roleId
        );

        const refresh_token = generate_refresh_token(
            user.id,
            user.fullName,
            user.email,
            user.roleId,
            sessionId
        );

        await prisma.userSession.update({
            where: {
                id: sessionId
            },
            data: {
                refreshTokenHash: await bcrypt.hash(refresh_token, 10)
            }
        });

        res.cookie("refreshToken", refresh_token, {
            httpOnly: true,
            secure: true,
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            message: "Login successful.",
            session_id: sessionId,
            accessToken: access_token,
            user: userResponse(user)
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            message: "Internal server error."
        });
    }
};


const OTP_verification = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        const otpRecord = await prisma.otp.findFirst({
            where: {
                email,
                otpType: "email_verification"
            }
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        if (otpRecord.expiresAt < new Date()) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired."
            });
        }

        const isValidOTP = await bcrypt.compare(
            otp,
            otpRecord.otpCodeHash
        );

        if (!isValidOTP) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { email },
                data: {
                    isVerified: true,
                    status: "active"
                }
            }),

            prisma.otp.deleteMany({
                where: {
                    email,
                    otpType: "email_verification"
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Email verified successfully."
        });

    } catch (error) {
        console.error("OTP Verification Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const resend_otp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        await prisma.otp.deleteMany({
            where: {
                email,
                otpType: "email_verification"
            }
        });

        const otp = generateOTP();

        const otpHash = await bcrypt.hash(otp, 10);

        await prisma.otp.create({
            data: {
                userId: user.id,
                email,
                otpCodeHash: otpHash,
                otpType: "email_verification",
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            }
        });

        await sendEmail(
            email,
            "Your OTP Code",
            `Your OTP code is: ${otp}`,
            getOtpHtml(otp)
        );

        return res.status(200).json({
            success: true,
            message: "A new verification OTP has been sent."
        });

    } catch (error) {
        console.error("Resend OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const verify_resend_OTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        const otpRecord = await prisma.otp.findFirst({
            where: {
                email,
                otpType: "email_verification"
            }
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: "OTP not found."
            });
        }

        if (otpRecord.expiresAt < new Date()) {
            return res.status(400).json({
                success: false,
                message: "OTP has expired."
            });
        }

        const isValidOTP = await bcrypt.compare(
            otp,
            otpRecord.otpCodeHash
        );

        if (!isValidOTP) {
            return res.status(400).json({
                success: false,
                message: "Invalid OTP."
            });
        }

        await prisma.$transaction([
            prisma.user.updateMany({
                where: {
                    email,
                    isVerified: false,
                    status: "inactive"
                },
                data: {
                    isVerified: true,
                    status: "active"
                }
            }),

            prisma.otp.delete({
                where: {
                    id: otpRecord.id
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "OTP verified successfully."
        });

    } catch (error) {
        console.error("Verify Resend OTP Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const log_out = async (req, res) => {
    try {
        const sessionId = req.user?.session_id;

        if (!sessionId) {
            return res.status(401).json({
                success: false,
                message: "Session information is missing."
            });
        }

        const session = await prisma.userSession.findFirst({
            where: {
                id: BigInt(sessionId),
                revoked: false
            }
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Session not found or already revoked."
            });
        }

        await prisma.userSession.update({
            where: {
                id: session.id
            },
            data: {
                revoked: true
            }
        });

        res.clearCookie("refreshToken");

        return res.status(200).json({
            success: true,
            session_id: session.id.toString(),
            message: "Logout successful."
        });

    } catch (error) {
        console.error("Logout Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const logout_all_devices = async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized user request."
            });
        }

        const result = await prisma.userSession.updateMany({
            where: {
                userId: BigInt(userId),
                revoked: false
            },
            data: {
                revoked: true
            }
        });

        if (result.count === 0) {
            return res.status(404).json({
                success: false,
                message: "No active sessions found."
            });
        }

        res.clearCookie("refreshToken");

        return res.status(200).json({
            success: true,
            message: "Logged out from all devices successfully."
        });

    } catch (error) {
        console.error("Logout All Devices Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const refresh = async (req, res) => {
    try {
        const user = req.user;

        if (!user?.id || !user?.session_id) {
            return res.status(401).json({
                success: false,
                message: "Invalid refresh token."
            });
        }

        const session = await prisma.userSession.findFirst({
            where: {
                id: BigInt(user.session_id),
                userId: BigInt(user.id),
                revoked: false
            }
        });

        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Invalid or revoked session."
            });
        }

        const refreshToken = generate_refresh_token(
            user.id,
            user.name,
            user.email,
            user.role_id,
            session.id
        );

        const accessToken = generate_access_token(
            user.id,
            user.name,
            user.email,
            user.role_id
        );

        await prisma.userSession.update({
            where: {
                id: session.id
            },
            data: {
                refreshTokenHash: await bcrypt.hash(refreshToken, 10),
                lastActivityAt: new Date()
            }
        });

        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: false,
            sameSite: "Strict",
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.status(200).json({
            success: true,
            session_id: session.id.toString(),
            message: "Tokens refreshed successfully.",
            access_token: accessToken
        });

    } catch (error) {
        console.error("Refresh Token Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const get_me = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized user request."
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: BigInt(userId)
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                id: user.id.toString(),
                full_name: user.fullName,
                email: user.email,
                phone_number: user.phoneNumber
            }
        });

    } catch (error) {
        console.error("Get Me Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const getUserById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "User ID is required."
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: BigInt(id)
            },
            select: {
                fullName: true,
                email: true,
                phoneNumber: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        return res.status(200).json({
            success: true,
            user: {
                full_name: user.fullName,
                email: user.email,
                phone_number: user.phoneNumber
            }
        });

    } catch (error) {
        console.error("Get User By ID Error:", error);

        return res.status(400).json({
            success: false,
            message: "Invalid user ID."
        });
    }
};


const forgot_password = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const user = await prisma.user.findUnique({
            where: { email },
            select: { id: true }
        });

        /*
         * Always return the same response whether the account exists
         * or not. This prevents user-enumeration through this endpoint.
         */
        if (!user) {
            return res.status(200).json({
                success: true,
                message: "If a user with that email exists, a password reset OTP has been sent."
            });
        }

        /*
         * Remove previous reset OTPs so that only the latest OTP remains valid.
         */
        await prisma.otp.deleteMany({
            where: {
                email,
                otpType: "reset_password"
            }
        });

        const otp = generateOTP();

        await prisma.otp.create({
            data: {
                userId: user.id,
                email,
                otpCodeHash: await bcrypt.hash(otp, 10),
                otpType: "reset_password",
                expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            }
        });

        await sendEmail(
            email,
            "Your Password Reset OTP",
            `Your OTP code is: ${otp}`,
            getOtpHtml(otp)
        );

        return res.status(200).json({
            success: true,
            message: "If a user with that email exists, a password reset OTP has been sent."
        });

    } catch (error) {
        console.error("Forgot Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


const reset_password = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({
                success: false,
                message: "Email and new password are required."
            });
        }

        const user = await prisma.user.findFirst({
            where: {
                email,
                isVerified: true
            },
            select: {
                id: true
            }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User not found or not verified."
            });
        }

        const passwordHash = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: {
                id: user.id
            },
            data: {
                passwordHash
            }
        });

        return res.status(200).json({
            success: true,
            message: "Password reset successfully."
        });

    } catch (error) {
        console.error("Reset Password Error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });
    }
};


export {
    registerUser, resend_otp, loginUser, refresh,
    OTP_verification, verify_resend_OTP, log_out, get_me,
    logout_all_devices, forgot_password, reset_password,
    getUserById
};
