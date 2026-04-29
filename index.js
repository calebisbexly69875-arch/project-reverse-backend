require("dotenv").config();

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

// Website/backend test route
app.get("/", (req, res) => {
  res.send("Project Reverse Auth Backend is running!");
});

// WPF launcher login route
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
  if (message.author.bot) return;

  const userId = message.author.id;
  const content = message.content.trim();
  const isDM = message.channel.type === 1;

  // Ping test
  if (content === "!ping") {
    message.reply("Pong!");
    return;
  }

  // Public/server signup command
  if (content === "!signup" && !isDM) {
    const users = loadUsers();

    const alreadySignedUp = users.find(u => u.discordId === userId);

    if (alreadySignedUp) {
      message.reply("You already have a Project Reverse account. Check your DMs for your username.");
      try {
        await message.author.send(`Your Project Reverse username is: **${alreadySignedUp.username}**`);
      } catch {
        message.reply("I could not DM you. Please enable DMs from server members.");
      }
      return;
    }

    signupSessions[userId] = {
      step: "username"
    };

    try {
      await message.author.send(
        "Welcome to Project Reverse signup.\n\nPlease reply with the username you want to use."
      );

      message.reply("Check your DMs to finish signup.");
    } catch {
      message.reply("I could not DM you. Please enable DMs from server members, then run `!signup` again.");
      delete signupSessions[userId];
    }

    return;
  }

  // DM signup command
  if (content === "!signup" && isDM) {
    const users = loadUsers();

    const alreadySignedUp = users.find(u => u.discordId === userId);

    if (alreadySignedUp) {
      message.reply(`You already have an account.\nUsername: **${alreadySignedUp.username}**`);
      return;
    }

    signupSessions[userId] = {
      step: "username"
    };

    message.reply("Please reply with the username you want to use.");
    return;
  }

  // Credentials command
  if (content === "!credentials") {
    const users = loadUsers();

    const user = users.find(u => u.discordId === userId);

    if (!user) {
      message.reply("You have not signed up yet. Type `!signup` in the server first.");
      return;
    }

    try {
      await message.author.send(
        `Your Project Reverse account:\nUsername: **${user.username}**\nPassword: **hidden for security**`
      );

      if (!isDM) {
        message.reply("I sent your account info in DMs.");
      }
    } catch {
      message.reply("I could not DM you. Please enable DMs from server members.");
    }

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

  // Only continue signup steps inside DMs
  if (!isDM) return;

  // Username step
  if (signupSessions[userId] && signupSessions[userId].step === "username") {
    const username = content;

    if (username.length < 3) {
      message.reply("Username must be at least 3 characters. Try again.");
      return;
    }

    if (username.length > 20) {
      message.reply("Username must be 20 characters or less. Try again.");
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

    message.reply("Now reply with the password you want to use.");
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

    const users = loadUsers();

    const alreadySignedUp = users.find(u => u.discordId === userId);

    if (alreadySignedUp) {
      delete signupSessions[userId];
      message.reply("You already have an account.");
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    users.push({
      discordId: userId,
      username: username,
      passwordHash: passwordHash,
      createdAt: new Date().toISOString()
    });

    saveUsers(users);

    delete signupSessions[userId];

    message.reply(
      `Signup successful!\n\nUsername: **${username}**\nPassword: **hidden for security**\n\nYou can now log in to the Project Reverse launcher.`
    );

    return;
  }
});

bot.once("clientReady", (client) => {
  console.log(`✅ Bot is online and ready as ${client.user.tag}`);
});

bot.login(process.env.BOT_TOKEN)
  .then(() => {
    console.log("✅ Discord login request succeeded.");
  })
  .catch((err) => {
    console.error("❌ Discord bot login failed:");
    console.error(err);
  });

bot.on("error", (err) => {
  console.error("❌ Discord client error:");
  console.error(err);
});

bot.on("shardError", (err) => {
  console.error("❌ Discord shard error:");
  console.error(err);
});

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});
