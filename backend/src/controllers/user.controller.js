import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

// @desc Register user
// @route POST /api/v1/users/register
// @access Public
const registerUser = asyncHandler(async (req, res) => {
  //get user details form frontend
  //validation - not empty
  //check if user exists ; username , email
  //check for images, and avatar
  //upload to cloudinary
  //create user object
  //remove password and refresh token from user object
  //check for user creation
  //return response

  const { fullName, email, password } = req.body;

  if (fullName == "") {
    return res.status(400).json(new ApiResponse(400, "Full name is required"));
  }

  if ([fullName, email, password].some((fields) => fields?.trim() === "")) {
    return res
      .status(400)
      .json(new ApiResponse(400, "All fields are required"));
  }
  const existedUser = await User.findOne({
    $or: [{ fullName }, { email }],
  });

  if (existedUser) {
    return res.status(409).json(new ApiResponse(409, "User already exists"));
  }

  const user = await User.create({
    fullName: fullName.toLowerCase(),
    email,
    password,
  });

  const createdUser = await User.findById(user._id).select("-password");

  if (!createdUser) {
    return res.status(500).json(new ApiResponse(500, "Error creating user"));
  }

  return res
    .status(201)
    .json(new ApiResponse(201, "User Registered successfully", createdUser));
});

// @desc Login user
// @route POST /api/v1/users/login
// @access Public
const loginUser = asyncHandler(async (req, res) => {
  //req body data
  //user naem and email validation
  // check if user exists
  //compare password
  //generate access and refresh token
  //return in cookies

  const { email, password } = req.body;

  if (!password && !email) {
    res
      .status(400)
      .json(new ApiResponse(400, "Email and password are required"));
    return;
  }

  const user = await User.findOne({ email });
  if (!user) {
    res.status(404).json(new ApiResponse(404, "User not found"));
    return;
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    res.status(401).json(new ApiResponse(401, "Invalid password"));
    return;
  }
  const JwtToken = user.generateJwtToken();

  const loggedInUser = await User.findById(user._id).select("-password");

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("JwtToken", JwtToken, options)
    .json(
      new ApiResponse(200, "User logged in successfully", {
        user: loggedInUser,
        JwtToken,
      })
    );
});

// @desc Forgot password
// @route POST /api/v1/users/forgot-password
// @access Public
const forgetPasswordSendEmail = asyncHandler(async (req, res) => {
  //get user email
  //check if user exists
  //generate reset token
  //send reset token to user email
  //return response
  const { email } = req.body;
  if (!email) {
    res.status(400).json(new ApiResponse(400, "Email is required"));
  }
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json(new ApiResponse(404, "Enter correct mail."));
  }
  const resetToken = user.generateResetToken();
  await user.save({ validateBeforeSave: false });
  //send email
  const resetUrl = `http://localhost:5173/reset-password/${user._id}/${resetToken}`;
  //send email using nodemailer or any other mailing service
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_PASSWORD,
      },
    });

    const mailOptions = {
      from: process.env.USER_EMAIL,
      to: user.email,
      subject: "Password Reset",
      text: `Dear ${user.fullName},\n\nPlease click on the following link ${resetUrl} to reset your password.\n\nIf you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        res.status(200).json(
          new ApiResponse(200, "Reset token sent to your email", {
            resetToken,
          })
        );
      }
    });
  } catch (err) {
    return res.status(500).json(new ApiResponse(500, "Error sending email"));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "Reset password link sent to your email"));
});

// @desc Reset password
// @route POST /api/v1/users/reset-password/:id/:token
// @access Public

const resetPassword = asyncHandler(async (req, res) => {
  //get user id and reset token
  //check if user exists
  //check if token is valid
  //update user password
  //return response
  const { id, token } = req.params;
  const { password } = req.body;
  if (!id || !token || !password) {
    return res.status(400).json(new ApiResponse(400, "Invalid request"));
  }
  const user = await User.findById(id);
  if (!user) {
    return res.status(404).json(new ApiResponse(404, "User not found"));
  }
  if (!user.resetToken) {
    return res.status(400).json(new ApiResponse(400, "Invalid reset link"));
  }

  if (user.resetToken !== token) {
    return res.status(400).json(new ApiResponse(400, "Invalid reset link"));
  }
  if (user.resetTokenExpire < Date.now()) {
    return res.status(400).json(new ApiResponse(400, "Reset link expired"));
  }

  try {
    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpire = undefined;
    await user.save();
    return res
      .status(200)
      .json(new ApiResponse(200, "Password reset successfully"));
  } catch (error) {
    return res
      .status(500)
      .json(new ApiResponse(500, "Error resetting password"));
  }
});

// @desc Logout user
// @route POST /api/v1/users/logout
// @access Private

const logoutUser = asyncHandler(async (req, res) => {
  //clear cookies
  //return response
  res.clearCookie("JwtToken");
  res.status(200).json(new ApiResponse(200, "User logged out successfully"));
});

// @desc update user profile
// @route POST /api/v1/users/update-user-profile
// @access Private

const updateUserProfile = asyncHandler(async (req, res) => {
  //get user id from token
  //get user details from frontend
  //update user profile
  //return respons

  try {
    const { fullName, email, location, userType, phone, address, city } =
      req.body;
    const profilePath = req.file?.path;
    const userId = req.user?._id;

    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "User not found");
    }
    const imgUrlCloudinary = await uploadOnCloudinary(profilePath);
    //console.log(imgUrlCloudinary);
    if (!imgUrlCloudinary.url) {
      return next(new ApiError(500, "Error uploading image"));
    }

    user.fullName = fullName ? fullName : user.fullName;
    user.email = email ? email : user.email;
    user.location = location ? location : user.location;
    user.userType = userType ? userType : user.userType;
    user.profilePicture = imgUrlCloudinary.url
      ? imgUrlCloudinary.url
      : user.profilePicture;
    user.phone = phone ? phone : user.phone;
    user.address = address ? address : user.address;
    user.city = city ? city : user.city;

    await user.save();

    res.json(new ApiResponse(200, "User profile updated successfully", user));
  } catch (error) {
    console.error(error);
    res
      .status(error.statusCode || 500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          error.message || "Internal Server Error"
        )
      );
  }
});

// @desc change current password
// @route POST /api/v1/users/change-password
// @access Private

const changeCurrentPassword = asyncHandler(async (req, res) => {
  try {
    //get user id from token
    const userId = req.user._id;
    //get old password and new password from frontend
    const { oldPassword, newPassword } = req.body;
   // console.log(oldPassword, newPassword, "old and new password")
    //validate old password and new password
    if (!oldPassword || !newPassword) {
      return res.status(400).json(new ApiResponse(400, "All fields are required"));
    }

    //check if the old password is correct
    const user = await User.findById(userId);

    if (!user || !(await user.comparePassword(oldPassword))) {
      return res.status(401).json(new ApiResponse(401, "Invalid old password"));
    }

    //if everything is ok then update the password
    user.password = newPassword;
    await user.save();

    //return response
    res.json(new ApiResponse(200, "Password changed successfully"));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          error.message || "Internal Server Error"
        )
      );
  }
});

// @desc get current user
// @route GET /api/v1/users/current-user
// @access Private
const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    return res
      .status(200)
      .json(200, "current user fetched successfully", req.user);
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          error.message || "Internal Server Error"
        )
      );
  }
});

// @desc get all users
// @route GET /api/v1/users
// @access Private/Admin
const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(new ApiResponse(200, "Users fetched successfully", users));
  } catch (error) {
    res
      .status(error.statusCode || 500)
      .json(
        new ApiResponse(
          error.statusCode || 500,
          error.message || "Internal Server Error"
        )
      );
  }
});

export {
  registerUser,
  loginUser,
  forgetPasswordSendEmail,
  resetPassword,
  logoutUser,
  updateUserProfile,
  changeCurrentPassword,
  getCurrentUser,
  getAllUsers,
};