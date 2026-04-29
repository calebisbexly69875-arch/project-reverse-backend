require("dotenv").config();

console.log("=== PROJECT REVERSE BOT STARTING ===");
console.log("BOT_TOKEN exists:", !!process.env.BOT_TOKEN);

const { Client, GatewayIntentBits, Partials } = require("discord.js");

const BACKEND_URL = "https://project-reverse-backend.onrender.com";

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

async function apiPost(path, data) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  return await response.json();
}

bot.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;

    const userId = message.author.id;
    const content = message.content.trim();
    const isDM = message.channel.type === 1;

    if (content === "!ping") {
      await message.reply("Pong!");
      return;
    }

    if (content === "!signup" && !isDM) {
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
      signupSessions[userId] = {
        step: "username"
      };

      await message.reply("Reply with the username you want to use.");
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

      const result = await apiPost("/discord-signup", {
        discordId: userId,
        username,
        password
      });

      delete signupSessions[userId];

      if (result.success) {
        await message.reply(
          `Signup successful!\n\nUsername: **${username}**\nPassword: **hidden for security**\n\nYou can now log in to the Project Reverse launcher.`
        );
      } else {
        await message.reply(result.message || "Signup failed. Try again.");
      }

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
