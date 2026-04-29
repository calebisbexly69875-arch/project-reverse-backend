require("dotenv").config();

console.log("=== PROJECT REVERSE COMBINED BACKEND STARTING ===");
console.log("BOT_TOKEN exists:", !!process.env.BOT_TOKEN);

const express = require("express");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Client, GatewayIntentBits, Partials } = require("discord.js");

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

// Website test route
app.get("/", (req, res) => {
  res.send("Project Reverse Auth Backend is running!");
});

// WPF launcher login route
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

// Discord bot
const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

const signupSessions = {};

bot.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.trim();

    // DM channel type check
    const isDM = message.channel.type === 1 || message.channel.type === "DM";

    if (content === "!ping") {
      await message.reply("Pong!");
      return;
    }

    if (content === "!signup" && !isDM) {
      const users = loadUsers();

      const alreadySignedUp = users.find(u => u.discordId === userId);

      if (alreadySignedUp) {
        await message.reply("You already have a Project Reverse account. I sent your username in DMs.");

        try {
          await message.author.send(
            `Your Project Reverse account:\nUsername: **${alreadySignedUp.username}**\nPassword: **hidden for security**`
          );
        } catch {
          await message.reply("I could not DM you. Please enable DMs from server members.");
        }

        return;
      }

      signupSessions[userId] = {
        step: "username"
      };

      try {
        await message.author.send(
          "Welcome to Project Reverse signup.\n\nReply with the username you want to use."
        );

        await message.reply("Check your DMs to finish signup.");
      } catch {
        delete signupSessions[userId];

        await message.reply(
          "I could not DM you. Please enable DMs from server members, then run `!signup` again."
        );
      }

      return;
    }

    if (content === "!signup" && isDM) {
      const users = loadUsers();

      const alreadySignedUp = users.find(u => u.discordId === userId);

      if (alreadySignedUp) {
        await message.reply(
          `You already have a Project Reverse account.\nUsername: **${alreadySignedUp.username}**\nPassword: **hidden for security**`
        );
        return;
      }

      signupSessions[userId] = {
        step: "username"
      };

      await message.reply("Reply with the username you want to use.");
      return;
    }

    if (content === "!credentials") {
      const users = loadUsers();

      const user = users.find(u => u.discordId === userId);

      if (!user) {
        await message.reply("You have not signed up yet. Type `!signup` first.");
        return;
      }

      try {
        await message.author.send(
          `Your Project Reverse account:\nUsername: **${user.username}**\nPassword: **hidden for security**`
        );

        if (!isDM) {
          await message.reply("I sent your account info in DMs.");
        }
      } catch {
        await message.reply("I could not DM you. Please enable DMs from server members.");
      }

      return;
    }

    if (content === "!cancel") {
      if (signupSessions[userId]) {
        delete signupSessions[userId];
        await message.reply("Signup cancelled.");
      } else {
        await message.reply("You are not currently signing up.");
      }

      return;
    }

    // Signup steps only happen in DMs
    if (!isDM) return;

    if (signupSessions[userId] && signupSessions[userId].step === "username") {
      const username = content;

      if (username.length < 3) {
        await message.reply("Username must be at least 3 characters. Try again.");
        return;
      }

      if (username.length > 20) {
        await message.reply("Username must be 20 characters or less. Try again.");
        return;
      }

      if (username.includes(" ")) {
        await message.reply("Username cannot have spaces. Try again.");
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        await message.reply("Username can only use letters, numbers, and underscores. Try again.");
        return;
      }

      const users = loadUsers();

      const existingDiscord = users.find(u => u.discordId === userId);

      if (existingDiscord) {
        delete signupSessions[userId];

        await message.reply(
          `You already have an account.\nUsername: **${existingDiscord.username}**`
        );

        return;
      }

      const usernameTaken = users.find(
        u => u.username.toLowerCase() === username.toLowerCase()
      );

      if (usernameTaken) {
        await message.reply("That username is already taken. Try another one.");
        return;
      }

      signupSessions[userId].username = username;
      signupSessions[userId].step = "password";

      await message.reply("Now reply with the password you want to use.");
      return;
    }

    if (signupSessions[userId] && signupSessions[userId].step === "password") {
      const password = content;
      const username = signupSessions[userId].username;

      if (password.length < 6) {
        await message.reply("Password must be at least 6 characters. Try again.");
        return;
      }

      const users = loadUsers();

      const existingDiscord = users.find(u => u.discordId === userId);

      if (existingDiscord) {
        delete signupSessions[userId];

        await message.reply(
          `You already have an account.\nUsername: **${existingDiscord.username}**`
        );

        return;
      }

      const usernameTaken = users.find(
        u => u.username.toLowerCase() === username.toLowerCase()
      );

      if (usernameTaken) {
        delete signupSessions[userId];

        await message.reply("That username was just taken. Please run `!signup` again.");
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);

      users.push({
        discordId: userId,
        username,
        passwordHash,
        createdAt: new Date().toISOString()
      });

      saveUsers(users);

      delete signupSessions[userId];

      await message.reply(
        `Signup successful!\n\nUsername: **${username}**\nPassword: **hidden for security**\n\nYou can now log in to the Project Reverse launcher.`
      );

      return;
    }
  } catch (err) {
    console.error("Message handler error:", err);

    try {
      await message.reply("Something went wrong. Try again.");
    } catch {}
  }
});

bot.once("ready", (client) => {
  console.log(`✅ Bot is online and ready as ${client.user.tag}`);
});

const discordToken = (process.env.BOT_TOKEN || "").trim();

console.log("Trying to login to Discord...");
console.log("Token length:", discordToken.length);

bot.login(discordToken)
  .then(() => {
    console.log("✅ Discord login request succeeded.");
  })
  .catch((err) => {
    console.error("❌ Discord bot login failed:");
    console.error(err);
  });

bot.on("error", (err) => {
  console.error("❌ Discord client error:", err);
});

bot.on("shardError", (err) => {
  console.error("❌ Discord shard error:", err);
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});
