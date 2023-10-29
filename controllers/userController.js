// IMPORTING MODULES
const { StatusCodes } = require("http-status-codes");
const path = require("path");

// CUSTOM MODULE IMPORTS

// IMPORTING DATABASE CONTROLLERS
const {
  READUSER,
  CREATEUSER,
  UPDATEUSER,
  DELETEUSER,
} = require("./db/userDatabase");

const { READOTP, CREATEOTP, DELETEOTP } = require("./db/otpDatabase");

const {
  CREATEBLACKLISTTOKEN,
  GETBLACKLISTTOKEN,
} = require("./db/tokenBlacklistDatabase");

// OTP GENERATOR CONTROLLER
const { OTPGENERATOR } = require("./optGenController");

// MAIL CONTROLLER
const { SENDMAIL } = require("./mails/mailController");

// SMS CONTROLLER
const { SENDSMS } = require("./messages/messageController");

// JWT CONTROLLER
const { GENERATETOKEN } = require("../middlewares/jwtAuthMW");

// REGISTER USER CONTROLLER
const registerUser = async (req, res) => {
  try {
    // 1. FETCHING DATA FROM REQUEST BODY
    const data = ({ username, phone, email, sapid } = req.body);

    // 2. CHECKING IF THE USER EXISTS
    const user = await READUSER([
      { phone: phone },
      { email: email },
      { sapid: sapid },
    ]);
    if (user.length > 0) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .send("User Already Exists! ❌");
    }

    // 3. CREATING FINAL DATA OBJECT
    const finaldata = { ...data, registeredOn: Date.now() };

    // 4. CREATING USER
    const created = await CREATEUSER(finaldata);

    // 5. SENDING USER
    if (created) {
      res.status(StatusCodes.CREATED).send({ userId: created._id });
    } else {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send("Error Creating User! ❌");
    }
  } catch (error) {
    // 6. HANDLING ERRORS
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error Creating User! ❌");
  }
};

// LOGIN USER CONTROLLER - MAIL
const loginUserMail = async (req, res) => {
  try {
    // 1. FETCHING DATA FROM REQUEST BODY
    const { email } = req.body;

    // 2. CHECKING IF USER ALREADY EXIST OR NOT
    const user = await READUSER([{ email: email }]);
    if (user.length !== 1) {
      return res.status(StatusCodes.NOT_FOUND).send("User Not Registered ❌");
    }

    // 3. CHECKING IF OTP EXISTS
    const otpexist = await READOTP([{ email: email }]);

    // 4. IF OTP EXIST AND NOT EXPIRED
    if (otpexist.length > 0 && otpexist[0].reRequestTime > Date.now()) {
      return res.status(StatusCodes.BAD_REQUEST).send("OTP Already Sent ✅");
    }

    // 5. GENERATE OTP
    const otpValue = OTPGENERATOR();
    // SENDING OTP THROUGH MAIL
    SENDMAIL(user[0].username, email, otpValue);

    // 6. CREATING OTP IN DATABASE
    await CREATEOTP({
      otpType: "EMAIL",
      email: email,
      otpValue: otpValue,
      issueTime: Date.now(),
      reRequestTime: Date.now() + 60000, // 1 minute
      expiryTime: Date.now() + 600000, //
    })
      .then((result) => {
        console.log("OTP Created ✅", result._id);
      })
      .catch((error) => {
        console.log("Error Creating OTP ❌", error);
      });

    // 7. SENDING RESPONSE
    return res.status(StatusCodes.OK).send("OTP Sent ✅");
  } catch (error) {
    // 8. Handling errors
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Error Logging In! ❌");
  }
};

// LOGIN USER CONTROLLER - PHONE
const loginUserPhone = async (req, res) => {
  try {
    // 1. FETCHING DATA FROM REQUEST BODY
    const { phone } = req.body;

    // 2. CHECKING IF USER ALREADY EXIST OR NOT
    const user = await READUSER([{ phone: phone }]);
    if (user.length !== 1) {
      return res.status(StatusCodes.NOT_FOUND).send("User Not Registered ❌");
    }

    // 3. CHECKING IF OTP EXISTS
    const otpexist = await READOTP([{ phone: phone }]);

    // 4. IF OTP EXIST AND NOT EXPIRED
    if (otpexist.length > 0 && otpexist[0].expiryTime > Date.now()) {
      return res.status(StatusCodes.BAD_REQUEST).send("OTP Already Sent ✅");
    }

    //5. GENERATE OTP
    const otpValue = OTPGENERATOR();
    // SENDING OTP THROUGH SMS
    SENDSMS(phone, otpValue);

    //6. CREATING OTP IN DATABASE
    await CREATEOTP({
      otpType: "SMS",
      phone: phone,
      otpValue: otpValue,
      issueTime: Date.now(),
      expiryTime: Date.now() + 600000,
    })
      .then((result) => {
        console.log("OTP Created ✅", result._id);
      })

      .catch((error) => {
        console.log("Error Creating OTP ❌", error);
      });

    return res.status(StatusCodes.OK).send("OTP Sent ✅");
  } catch (error) {
    // 7. Handling errors
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Error Logging In! ❌");
  }
};

// LOGOUT USER CONTROLLER
const logOutUser = async (req, res) => {
  try {
    // 1. FETCHING TOKEN FROM REQUEST HEADERS
    const token = req.headers.authorization;

    // 2. CHECKING IF TOKEN IS ALREADY BLACKLISTED
    const blackListed = await GETBLACKLISTTOKEN({ token: token });

    // 3. IF TOKEN IS NOT BLACKLISTED THEN BLACKLIST IT
    if (blackListed.length === 0) {
      await CREATEBLACKLISTTOKEN({
        token: token,
      });
    }

    // 4. SENDING RESPONSE
    res.status(StatusCodes.OK).send("Logged Out ✅");
  } catch (error) {
    console.log(error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).send("Error logging out ❌");
  }
};

// VERIFY OTP CONTROLLER - MAIL
const verifyOTPMail = async (req, res) => {
  try {
    // 1. FETCHNG DATA FROM REQUEST BODY
    const { email, otpValue } = req.body;

    // 2. CHECKING IF OTP EXISTS
    const otpexist = await READOTP([{ email: email }]);

    // 3. CHECKING IF OTP IS VALID
    if (otpexist.length !== 1) {
      return res.status(StatusCodes.NOT_FOUND).send("OTP Not Found ❌");
    }

    // 4. CHECKING IF OTP IS EXPIRED
    if (otpexist[0].expiryTime < Date.now()) {
      return res.status(StatusCodes.BAD_REQUEST).send("OTP Expired ❌");
    }
    // 5. CHECKING IF OTP IS CORRECT
    if (otpexist[0].otpValue !== otpValue) {
      return res.status(StatusCodes.BAD_REQUEST).send("OTP Incorrect ❌");
    }
    // 6. DELETING OTP FROM DATABASE
    await DELETEOTP({ email: email })
      .then((result) => {
        console.log("OTP Deleted ✅", result._id);
      })
      .catch((error) => {
        console.log("Error Deleting OTP ❌", error);
      });

    // 7. FETCHING USER DATA
    const user = await READUSER([{ email: email }]);

    // 8. CREATING PAYLOAD
    const payload = {
      userId: user[0]._id,
    };

    // 9. CREATING TOKEN
    const token = GENERATETOKEN(payload, "36500d"); // 100 years
    return res.status(StatusCodes.OK).send({ token: token });
  } catch (error) {
    // 10. HANDLING ERRORS
    console.log(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error Verifying OTP! ❌");
  }
};

// VERIFY OTP CONTROLLER - PHONE
const verifyOTPPhone = async (req, res) => {
  try {
    // 1. FETCHNG DATA FROM REQUEST BODY
    const { phone, otpValue } = req.body;

    // 2. CHECKING IF OTP EXISTS
    const otpexist = await READOTP([{ phone: phone }]);

    // 3. CHECKING IF OTP IS VALID
    if (otpexist.length !== 1) {
      return res.status(StatusCodes.NOT_FOUND).send("OTP Not Found ❌");
    }

    // 4. CHECKING IF OTP IS EXPIRED
    if (otpexist[0].expiryTime < Date.now()) {
      return res.status(StatusCodes.BAD_REQUEST).send("OTP Expired ❌");
    }

    // 5. CHECKING IF OTP IS CORRECT
    if (otpexist[0].otpValue !== otpValue) {
      return res.status(StatusCodes.BAD_REQUEST).send("OTP Incorrect ❌");
    }

    // 6. DELETING OTP FROM DATABASE
    await DELETEOTP({ phone: phone })
      .then((result) => {
        console.log("OTP Deleted ✅", result._id);
      })
      .catch((error) => {
        console.log("Error Deleting OTP ❌", error);
      });

    // 7. FETCHING USER DATA
    const user = await READUSER([{ phone: phone }]);

    // 8. CREATING PAYLOAD
    const payload = {
      userId: user[0]._id,
    };

    // 9. CREATING TOKEN
    const token = GENERATETOKEN(payload, "36500d"); // 100 years

    // 10. SENDING RESPONSE
    return res.status(StatusCodes.OK).send({ token: token });
  } catch (error) {
    // 11. HANDLING ERRORS
    console.log(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error Verifying OTP! ❌");
  }
};

// GET USER DETAILS CONTROLLER
const readUser = async (req, res) => {
  try {
    // 1. FETCHING DATA FROM REQUEST BODY
    let { query } = req.body;

    // 2. CHECKING IF QUERY IS EMPTY
    if (query === undefined || query === null) {
      query = { _id: req.body.payload.userId };
    }

    // 2. CHECKING IF USER EXISTS
    const user = await READUSER([query]);

    // 3. SENDING RESPONSE
    if (user.length === 1) {
      res.status(StatusCodes.OK).send(user);
    } else {
      res.status(StatusCodes.NOT_FOUND).send("User Not Found ❌");
    }
  } catch (error) {
    // 4. HANDLING ERRORS
    console.log(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error Getting User Details! ❌");
  }
};

// UPDATE USER DETAILS CONTROLLER
const updateUser = async (req, res) => {
  try {
    // 1. FETCHING DATA FROM REQUEST BODY
    const { query, data } = req.body;

    // 2. CHECKING IF QUERY IS EMPTY
    if (query === undefined || query === null) {
      query = { _id: req.body.payload.userId };
    } else {
      // 3. CHECKING IF USER EXISTS
      const user = await READUSER([query]);

      if (user.length === 0) {
        return res.status(StatusCodes.NOT_FOUND).send("User Not Found ❌");
      }

      // 4. FETCHING USER ID
      const userId = user[0]._id;

      // 5. CHECKING IF USER IS AUTHORIZED
      if (userId != req.body.payload.userId) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .send("User Not Authorized ❌");
      }
    }

    // 6. UPDATING USER
    const updated = await UPDATEUSER(query, data);

    // 7. SENDING RESPONSE
    if (updated) {
      res.status(StatusCodes.OK).send(updated);
    } else {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send("Error Updating User! ❌");
    }
  } catch (error) {
    // 8. HANDLING ERRORS
    console.log(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error Updating User! ❌");
  }
};

// DELETE USER CONTROLLER
const deleteUser = async (req, res) => {
  try {
    // 1. FETCHING DATA FROM REQUEST BODY
    const { query } = req.body;

    // 2. CHECKING IF QUERY IS EMPTY
    if (query === undefined || query === null) {
      query = { _id: req.body.payload.userId };
    } else {
      // 3. CHECKING IF USER EXISTS
      const user = await READUSER([query]);
      if (user.length === 0) {
        return res.status(StatusCodes.NOT_FOUND).send("User Not Found ❌");
      }

      // 4. CHECKING IF USER IS AUTHORIZED
      if (user[0]._id !== req.body.payload.userId) {
        return res
          .status(StatusCodes.UNAUTHORIZED)
          .send("User Not Authorized ❌");
      }
    }

    // 5. DELETING USER
    const deleted = await DELETEUSER(query);

    // 6. SENDING RESPONSE
    if (deleted) {
      res.status(StatusCodes.OK).send("User Deleted ✅", deleted);
    } else {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send("Error Deleting User! ❌");
    }
  } catch (error) {
    // 7. HANDLING ERRORS
    console.log(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error Deleting User! ❌");
  }
};

// UPLOAD PROFILE PIC CONTROLLER
const uploadProfilePic = async (req, res) => {
  try {
    // 0. SETTING DEFAULT URL
    const defaultUrl = "http://localhost:3000/img/profilePic/";

    console.log(req.body);

    // 1. FETCHING DATA FROM REQUEST BODY
    const query = { _id: req.body.payload.userId };

    // 2. CHECKING IF USER EXISTS
    const user = await READUSER([query]);
    if (user.length === 0) {
      return res.status(StatusCodes.NOT_FOUND).send("User Not Found ❌");
    }

    // 3. FETCHING USER ID
    const userId = user[0]._id;

    // 4. CHECKING IF USER IS AUTHORIZED
    if (userId != req.body.payload.userId) {
      return res
        .status(StatusCodes.UNAUTHORIZED)
        .send("User Not Authorized ❌");
    }

    // 5. CREATING DATA OBJECT
    const extension = path.extname(req.files.profilePic[0].filename),
      filename = user[0].email;
    const data = {
      profilePic: defaultUrl + filename + extension,
    };

    // 6. UPDATING USER
    const updated = await UPDATEUSER({ _id: userId }, data);

    // 7. SENDING RESPONSE
    if (updated) {
      res.status(StatusCodes.OK).send("Profile Pic Uploaded ✅");
    } else {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .send("Error Uploading Profile Pic! ❌");
    }
  } catch (error) {
    // 8. HANDLING ERRORS
    console.log(error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .send("Error Uploading Profile Pic! ❌");
  }
};

// EXPORTING MODULES
module.exports = {
  LOGINUSERMAIL: loginUserMail,
  VERIFYOTPMAIL: verifyOTPMail,
  LOGINUSERPHONE: loginUserPhone,
  VERIFYOTPPHONE: verifyOTPPhone,
  REGISTERUSER: registerUser,
  READUSER: readUser,
  UPDATEUSER: updateUser,
  DELETEUSER: deleteUser,
  LOGOUTUSER: logOutUser,
  UPLOADPROFILEPIC: uploadProfilePic,
};
