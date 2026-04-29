require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

const usersFile = path.join(__dirname, "users.json");

// Create users.json if it does not exist
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

// Backend test page
app.get("/", (req, res) => {
  res.send("Project Reverse Auth Backend is running!");
});

// Emulator login endpoint
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: "Missing username or password"
    });
  }

  const users = loadUsers();

  const user = users.find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Invalid username or password"
    });
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    return res.status(401).json({
      success: false,
      message: "Invalid username or password"
    });
  }

  return res.json({
    success: true,
    message: "Login successful",
    username: user.username,
    discordId: user.discordId
  });
});

// Discord bot setup
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const signupSessions = {};

bot.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  const userId = message.author.id;
  const content = message.content.trim();

  // Test command
  if (content === "!ping") {
    message.reply("Pong!");
    return;
  }

  // Start signup
  if (content === "!signup") {
    const users = loadUsers();

    const alreadySignedUp = users.find(u => u.discordId === userId);

    if (alreadySignedUp) {
      message.reply("You already signed up. Use `!credentials` to see your username.");
      return;
    }

    if (signupSessions[userId]) {
      message.reply("You are already signing up. Please finish the current step.");
      return;
    }

    signupSessions[userId] = {
      step: "username"
    };

    message.reply("Please provide your username for signup.");
    return;
  }

  // Show username only
  if (content === "!credentials") {
    const users = loadUsers();

    const user = users.find(u => u.discordId === userId);

    if (!user) {
      message.reply("You have not signed up yet. Type `!signup` first.");
      return;
    }

    message.reply(
      `Your Project Reverse account:\nUsername: **${user.username}**\nPassword: **hidden for security**`
    );
    return;
  }

  // Cancel signup
  if (content === "!cancel") {
    if (signupSessions[userId]) {
      delete signupSessions[userId];
      message.reply("Signup cancelled.");
    }
    return;
  }

  // Username step
  if (signupSessions[userId] && signupSessions[userId].step === "username") {
    const username = content;

    if (username.length < 3) {
      message.reply("Username must be at least 3 characters. Try again.");
      return;
    }

    if (username.includes(" ")) {
      message.reply("Username cannot have spaces. Try again.");
      return;
    }

    const users = loadUsers();

    const usernameTaken = users.find(
      u => u.username.toLowerCase() === username.toLowerCase()
    );

    if (usernameTaken) {
      message.reply("That username is already taken. Try another one.");
      return;
    }

    signupSessions[userId].username = username;
    signupSessions[userId].step = "password";

    message.reply("Please provide your password.");
    return;
  }

  // Password step
  if (signupSessions[userId] && signupSessions[userId].step === "password") {
    const password = content;
    const username = signupSessions[userId].username;

    if (password.length < 6) {
      message.reply("Password must be at least 6 characters. Try again.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const users = loadUsers();

    users.push({
      discordId: userId,
      username: username,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    });

    saveUsers(users);

    delete signupSessions[userId];

    message.reply(
      `Signup successful for **${username}**!\nYou can now log in to the Project Reverse emulator with that username and password.`
    );

    return;
  }
});

bot.once("clientReady", () => {
  console.log("Bot is online and ready!");
});

bot.login(process.env.BOT_TOKEN);

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});