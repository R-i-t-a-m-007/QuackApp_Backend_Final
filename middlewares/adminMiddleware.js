import jwt from "jsonwebtoken";
import Admin from '../models/Admin.js'; // Import the Admin model

const adminMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.split(" ")[1]; // Extract token from "Bearer ..."

  if (!token) {
    console.log("No token received."); // Debugging
    return res.status(401).json({ message: "No token, authorization denied." });
  }

  try {
    console.log("Token received:", token); // Debugging

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find the admin by ID
    const admin = await Admin.findById(decoded.id).select("-password");

    if (!admin) {
      console.log("Admin not found.");
      return res.status(401).json({ message: "Admin not found, authorization denied." });
    }

    req.admin = admin; // Attach admin info to request
    next(); // Proceed to next middleware or controller
  } catch (err) {
    console.error("JWT Verification Error:", err.message);
    
    // Handle specific JWT errors
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired, please log in again." });
    } else if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token, authorization denied." });
    }

    return res.status(401).json({ message: "Token is not valid." });
  }
};

export default adminMiddleware;
