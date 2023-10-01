// MODULES IMPORT
const express = require("express");

// CONTROLLERS IMPORT
const {
  LOGINUSERMAIL,
  VERIFYOTPMAIL,
  LOGINUSERPHONE,
  VERIFYOTPPHONE,
  REGISTERUSER,
  READUSER,
  UPDATEUSER,
  DELETEUSER,
  LOGOUTUSER
} = require("../controllers/userController");

const {
  GETPARKING,
  FINDCAR,
  BOOKPARKING,
  RAISEISSUE,
} = require("../controllers/parkingController");

// MIDDLEWARES IMPORT
const { VERIFYUSERMW } = require("../middlewares/userMW");

// JWT IMPORT AND BLACKLIST CHECK IMPORT
const { VERIFYTOKEN } = require("../middlewares/jwtAuthMW");

// CREATING ROUTER
const USER = express.Router();

// API ENDPOINTS
USER.get("/test", (req, res) => {
  res.send("test");
});

// USER ROUTES
USER.post("/register", VERIFYUSERMW, REGISTERUSER);
USER.post("/login/mail", LOGINUSERMAIL);
USER.post("/verify/mail", VERIFYOTPMAIL);
USER.post("/login/phone", LOGINUSERPHONE);
USER.post("/verify/phone", VERIFYOTPPHONE);
USER.post("/getUser", VERIFYTOKEN, READUSER);

USER.post("/updateUser",  VERIFYTOKEN,UPDATEUSER);
USER.post("/deleteUser", VERIFYTOKEN, DELETEUSER);
USER.post("/logout", VERIFYTOKEN,LOGOUTUSER);

// PARKING ROUTES
USER.post("/raiseIssue", RAISEISSUE);
USER.post("/findcar", FINDCAR);
USER.post("/bookParking", BOOKPARKING);
USER.post("/getParking", GETPARKING);

// EXPORTING ROUTER
module.exports = {
  USERROUTER: USER,
};
