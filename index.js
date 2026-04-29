require("dotenv").config();

console.log("=== PROJECT REVERSE API STARTING ===");

const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

const usersFile = path.join(__dirname, "users.json");

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
}

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

app.get("/", (req, res) => {
  res.send("Project Reverse Auth Backend is running!");
});

// Bot uses this route to create accounts
app.post("/discord-signup", async (req, res) => {
  try {
    const { discordId, username, password } = req.body;

    if (!discordId || !username || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing signup info."
      });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Username must be 3-20 characters."
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({
        success: false,
        message: "Username can only use letters, numbers, and underscores."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters."
      });
    }

    const users = loadUsers();

    const existingDiscord = users.find(u => u.discordId === discordId);

    if (existingDiscord) {
      return res.status(409).json({
        success: false,
        message: "You already have an account."
      });
    }

    const usernameTaken = users.find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );

    if (usernameTaken) {
      return res.status(409).json({
        success: false,
        message: "That username is already taken."
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    users.push({
      discordId,
      username,
      passwordHash,
      createdAt: new Date().toISOString()
    });

    saveUsers(users);

    return res.json({
      success: true,
      message: "Signup successful.",
      username
    });
  } catch (err) {
    console.error("Discord signup error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error during signup."
    });
  }
});

// WPF launcher uses this route to log in
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Missing username or password."
      });
    }

    const users = loadUsers();

    const user = users.find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password."
      });
    }

    return res.json({
      success: true,
      message: "Login successful.",
      username: user.username,
      discordId: user.discordId
    });
  } catch (err) {
    console.error("Login error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error during login."
    });
  }
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
