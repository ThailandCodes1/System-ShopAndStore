const { Events, EmbedBuilder, ActionRowBuilder, ChannelType, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js");
const axios = require("axios");
const client = require("../index")
const { Database, YAMLDriver } = require('st.db');
const db = new Database({
    driver: new YAMLDriver('./Database/Database.yaml')
});
const AllData = require("../Database/MessagesAndRolesAndChannels")
const moment = require("moment");
require("moment-duration-format");
moment.locale("ar");


client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const command = client.SlashCommands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction, client);
    }
    catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});
client.setMaxListeners(0);





//نظام الضارائب التلقائي
client.on(Events.MessageCreate, async message => {
    const channel = await db.get(`autotax_${message.guild.id}`);
    if (message.author.bot || !message.guild) return;
    if (message.channel.id !== channel?.channelID) return;

    let input = message.content.trim().toLowerCase();
    let amount;
    if (input.endsWith("k")) amount = parseFloat(input) * 1000;
    else if (input.endsWith("m")) amount = parseFloat(input) * 1000000;
    else if (input.endsWith("b")) amount = parseFloat(input) * 1000000000;
    else amount = parseFloat(input);

    if (isNaN(amount) || amount <= 0)
        return message.reply("❌ اكتب رقم صحيح لحساب الضريبة.");
    let tax = amount * 0.05;
    let received = amount - tax;
    let needed = amount / 0.95;

    const format = num => num.toLocaleString();

    message.reply({
        content: `
• :coin: **ضريبة مبلغ ${format(amount)}**

• 💳 كم بيسحب منك البوت: \`${tax.toFixed(0)}\` (**${format(Math.round(tax))}**)
• 💵 كم بتوصل الى شخص: \`${received.toFixed(0)}\` (**${format(Math.round(received))}**)
• 💰 كم لازم تحول عشان يوصل المبلغ بالضبط: \`${needed.toFixed(0)}\` (**${format(Math.round(needed))}**)
`
    });
});



//نظام الفيدباك
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const channel = await db.get(`feedback_${message.guild.id}`);
    if (!channel || message.channel.id !== channel?.channelID) return;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId("star_1").setLabel("⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("star_2").setLabel("⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("star_3").setLabel("⭐⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("star_4").setLabel("⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId("star_5").setLabel("⭐⭐⭐⭐⭐").setStyle(ButtonStyle.Secondary)
    );
    const msg = await message.reply({
        content: `💬 **${message.author.username}**, اختر تقييمك لرسالتك:`,
        components: [row]
    });
    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on("collect", async interaction => {
        if (interaction.user.id !== message.author.id)
            return interaction.reply({ content: "الزر دا مش بتاعك", ephemeral: true });
        const stars = interaction.customId.split("_")[1];
        collector.stop();
        try {
            await message.delete().catch(() => { });
            await msg.delete().catch(() => { });
        } catch { }

        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .addFields(
                { name: "المستخدم:", value: `${message.author}`, inline: true },
                { name: "التقييم:", value: `${"⭐".repeat(stars)} (\`${stars} نجوم\`)`, inline: true },
                { name: "الرسالة:", value: `${message.content}` },
            )
            .setColor("#FFD700")
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    });
    collector.on("end", async () => {
        if (!msg.delete) {
            msg.edit({ components: [] }).catch(() => { });
        }
    });
});


//نظام الاقتراحات
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const channelData = await db.get(`suggestion_${message.guild.id}`);
    if (!channelData || message.channel.id !== channelData.channelID) return;

    await message.delete().catch(() => { });

    const embed = new EmbedBuilder()
        .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setDescription(message.content)
        .setColor("Blue")
        .setTimestamp()
        .setFooter({ text: `اقتراحات | ${message.guild.name}` });

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`suggest_blacklist_${message.author.id}`)
            .setLabel("Blacklist")
            .setEmoji("🚫")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId(`suggest_delete_${message.author.id}`)
            .setLabel("Delete")
            .setEmoji("🗑️")
            .setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.channel.send({ embeds: [embed], components: [buttons] });

    const thread = await msg.startThread({
        name: `${message.author.username}`,
        reason: "لمناقشة الاقتراح"
    });
    thread.send(`شكراً لك على اقتراحك ${message.author}`);
});


client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    const [prefix, action, userId] = interaction.customId.split("_");
    if (prefix !== "suggest") return;

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({ content: "دور على حد يعطيك صلاحيات يا فقير", ephemeral: true });
    }
    if (action === "blacklist") {
        try {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            const suggestionChannelData = await db.get(`suggestion_${interaction.guild.id}`);
            if (!member || !suggestionChannelData) return interaction.reply({ content: "ماقدرتش ألاقي العضو أو روم الاقتراحات!", ephemeral: true });
            const channel = interaction.guild.channels.cache.get(suggestionChannelData.channelID);
            if (!channel) return interaction.reply({ content: "روم الاقتراحات مش موجود", ephemeral: true });
            await channel.permissionOverwrites.edit(member.id, {
                SendMessages: false,
                AddReactions: false
            });
            const newButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`suggest_unblacklist_${member.id}`)
                    .setLabel("Unblacklist")
                    .setEmoji("✅")
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`suggest_delete_${member.id}`)
                    .setLabel("Delete")
                    .setEmoji("🗑️")
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.message.edit({ components: [newButtons] });

            await interaction.reply({ content: `تم منع <@${member.id}> من إرسال اقتراحات.`, ephemeral: true });
        } catch (err) {
            console.error(err);
        }
    }
    if (action === "unblacklist") {
        try {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            const data = await db.get(`suggestion_${interaction.guild.id}`);
            if (!member || !data) return interaction.reply({ content: "ماقدرتش ألاقي العضو أو روم الاقتراحات", ephemeral: true });

            const channel = interaction.guild.channels.cache.get(data.channelID);
            if (!channel) return interaction.reply({ content: "روم الاقتراحات مش موجود", ephemeral: true });

            await channel.permissionOverwrites.delete(member.id).catch(() => { });

            const newButtons = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`suggest_blacklist_${member.id}`)
                    .setLabel("Blacklist")
                    .setEmoji("🚫")
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`suggest_delete_${member.id}`)
                    .setLabel("Delete")
                    .setEmoji("🗑️")
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.message.edit({ components: [newButtons] });

            await interaction.reply({ content: `تم فك المنع عن <@${member.id}> ويقدر يرسل اقتراحات تاني.`, ephemeral: true });
        } catch (err) {
            console.error(err);
        }
    }
    if (action === "delete") {
        try {
            const thread = interaction.channel.isThread() ? interaction.channel : null;
            const message = !thread ? interaction.message : await interaction.channel.fetchStarterMessage();
            await message.delete().catch(() => { });
            if (thread) await thread.delete().catch(() => { });
            await interaction.reply({ content: "تم حذف الاقتراح", ephemeral: true });
        } catch (err) {
            console.error(err);
        }
    }
});

//نظام العروض

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const channelData = await db.get(`offers_${message.guild.id}`);
    if (!channelData || message.channel.id !== channelData.channelID) return;

    const mode = await db.get(`server_mode_${message.guild.id}`) || "shops";
    const roles = AllData.OffersRoles
    const files = [];

    for (const attachment of message.attachments.values()) {
        try {
            const response = await axios.get(attachment.url, {
                responseType: "arraybuffer",
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            files.push({
                attachment: Buffer.from(response.data),
                name: attachment.name
            });
        } catch (err) { }
    }

    await message.delete().catch(() => { });

    let webhooks = await message.channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.name === "Offers Webhook");
    if (!webhook) {
        webhook = await message.channel.createWebhook({
            name: "Offers Webhook",
            avatar: message.guild.iconURL({ dynamic: true })
        });
    }

    const offerId = Math.floor(100000 + Math.random() * 900000);

    if (mode === "shops") {
        const content = `${message.content || ""}\n\n-# رقم المنشور: **\`${offerId}\`**\n-# منشور من قبل: ${message.author}\n-# ${roles.map(id => `<@&${id}>`).join(" ")}`;
       let msg = await webhook.send({
            username: message.member.displayName,
            avatarURL: message.author.displayAvatarURL({ dynamic: true }),
            content,
            files
        });
            await db.set(`offer_${offerId}`, {
            msgId: msg.id,
            channelId: message.channel.id,
            sellerId: message.author.id,
            guildId: message.guild.id
        });
    } else if (mode === "store") {
        const content = `${message.content || ""}\n\n-# رقم المنشور: **\`${offerId}\`**\n-# منشور من قبل: ${message.author}\n-# ${roles.map(id => `<@&${id}>`).join(" ")}`;
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`buy_${message.author.id}_${offerId}`)
                .setLabel("طلب")
                .setEmoji("🛒")
                .setStyle(ButtonStyle.Secondary)
        );

        const msg = await webhook.send({
            username: message.member.displayName,
            avatarURL: message.author.displayAvatarURL({ dynamic: true }),
            content,
            files,
            components: [row]
        });

        await db.set(`offer_${offerId}`, {
            msgId: msg.id,
            channelId: message.channel.id,
            sellerId: message.author.id,
            guildId: message.guild.id
        });
    }
});


client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;

    // زر الشراء
    if (interaction.customId.startsWith("buy_")) {
        const [, sellerId, offerId] = interaction.customId.split("_");
        const offer = await db.get(`offer_${offerId}`);
        const buyer = interaction.user;
        const guild = interaction.guild;

        if (!offer) return interaction.reply({ content: "معرف المنشور دا مش موجود أو اتحذف.", ephemeral: true });

        const categoryId = AllData.Category;
        if (!categoryId) return interaction.reply({ content: "الظاهر كدا ان صاحب السيرفر نسي يحدد الكاتجري", ephemeral: true });

        const seller = await guild.members.fetch(sellerId).catch(() => null);
        if (!seller) return interaction.reply({ content: "ملقتش البائع ف السيرفر", ephemeral: true });

        const channel = await guild.channels.create({
            name: `ticket-${buyer.username}`,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: buyer.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: seller.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] }
            ]
        });

        await interaction.reply({ content: `✅ تم فتح تذكرتك: ${channel}`, ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle("طلب جديد")
            .addFields(
                { name: "المشتري", value: `${buyer}`, inline: true },
                { name: "البائع", value: `${seller}`, inline: true },
                { name: "رقم المنشور", value: `**\`${offerId}\`**`, inline: false }
            )
            .setColor("Green")
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`come_${buyer.id}`)
                .setLabel("استدعاء")
                .setEmoji("📩")
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId("close_ticket")
                .setLabel("اغلاق التذكرة")
                .setEmoji("🔒")
                .setStyle(ButtonStyle.Danger)
        );

        await channel.send({
            content: `مرحبا بك في تذكرتك الخاصة مع البائع ${seller}!\nيرجى مناقشة تفاصيل الشراء هنا.`,
            embeds: [embed],
            components: [row]
        });
    }

    if (interaction.customId.startsWith("come_")) {
        const [, buyerId] = interaction.customId.split("_");
        const buyerUser = await client.users.fetch(buyerId).catch(() => null);
        if (!buyerUser) return interaction.reply({ content: "ملقتش المشتري.", ephemeral: true });

        try {
            await buyerUser.send({
                content: `📩 البائع استدعاك للتذكرة!\nادخل من هنا: ${interaction.channel.url}`
            });
            await interaction.reply({ content: "✅ تم استدعاء المشتري في الخاص.", ephemeral: true });
        } catch {
            await interaction.reply({ content: "❌ مقدرتش ابعت للمشتري في الخاص (يمكن قافل الخاص).", ephemeral: true });
        }
    }

    if (interaction.customId === "close_ticket") {
        const confirmRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("confirm_close")
                .setLabel("متاكد؟")
                .setEmoji("✅")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("cancel_close")
                .setLabel("الغاء")
                .setEmoji("❌")
                .setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ content: "انت متأكد انك عايز تقفل التذكرة؟", components: [confirmRow], ephemeral: true });
    }

    if (interaction.customId === "confirm_close") {
        await interaction.reply({ content: "⏳ جاري اغلاق التذكرة...", ephemeral: true });
        setTimeout(() => {
            interaction.channel.delete().catch(() => { });
        }, 2000);
    }

    if (interaction.customId === "cancel_close") {
        await interaction.reply({ content: "تمام، مش هنقفل التذكرة 👌", ephemeral: true });
    }
});


//نظام الردود التلقائييه
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const roles = AllData.Sellers
    const Sellers = message.member.roles.cache.some(r => roles.includes(r.id));
    if (!Sellers) return;
    if (message.content === "برمجه") {
        message.channel.send(AllData.Programming);
    } else if (message.content === "تحويل") {
        message.channel.send(AllData.transformation);
    } else if (message.content === "تقييم") {
        message.channel.send(AllData.evaluation);
    } else if (message.content === "خمول") {
        message.channel.send(AllData.Lethargy);
    } else if (message.content === "تصاميم") {
        message.channel.send(AllData.Designs);
    }
});







//الاوامر
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (message.content == `${prefix}ping`) {
        const sent = await message.channel.send("1.2.3");
        sent.edit(`بونج 🏓! الوقت المستغرق: \`${sent.createdTimestamp - message.createdTimestamp}ms\`.`);
    }
})
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (message.content == `${prefix}serverinfo`) {
        const { guild } = message;
        const owner = await guild.fetchOwner();
        const embed = new EmbedBuilder()
            .setAuthor({ name: `📊 Server Info`, iconURL: guild.iconURL({ dynamic: true }) })
            .setTitle(`✨ ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true, size: 1024 }))
            .setDescription(`> 🏰 **معلومات السيرفر العامة**`)
            .addFields(
                { name: "🆔 معرف السيرفر", value: `\`${guild.id}\``, inline: true },
                { name: "👑 المالك", value: `${owner.user.tag}`, inline: true },
                { name: "🧩 عدد الرولات", value: `${guild.roles.cache.size}`, inline: true },
                { name: "👥 عدد الاعضاء", value: `${guild.memberCount}`, inline: true },
                { name: "💬 عدد الرومات", value: `${guild.channels.cache.size}`, inline: true },
                { name: "📢 عدد الرومات الصوتية", value: `${guild.channels.cache.filter(c => c.type === 2).size}`, inline: true },
                { name: "🛡️ مستوى التحقق", value: `${guild.verificationLevel}`, inline: true },
                { name: "📅 انشاء السيرفر", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
            )
            .setFooter({ text: `Requested by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
            .setColor("Blurple")
            .setTimestamp()
        message.channel.send({ embeds: [embed] });
    }
})

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";

    if (!message.content.startsWith(`${prefix}userinfo`)) return;

    const args = message.content.split(" ").slice(1);
    const member =
        message.mentions.members.first() ||
        (args[0] ? await message.guild.members.fetch(args[0]).catch(() => null) : message.member);

    if (!member) return message.reply("⚠️ العضو مش موجود أو الآيدي غلط.");

    const user = member.user;

    const embed = new EmbedBuilder()
        .setAuthor({ name: `${user.tag}`, iconURL: user.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 1024 }))
        .setColor("#00BFFF")
        .addFields(
            { name: "🆔 الآيدي", value: `${user.id}`, inline: true },
            { name: "👤 الاسم", value: `${user.username}`, inline: true },
            { name: "📆 أنشأ حسابه في", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:f>`, inline: false },
            { name: "🚪 دخل السيرفر في", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:f>`, inline: false },
            {
                name: "🏷️ الرتب",
                value:
                    member.roles.cache.filter(r => r.id !== message.guild.id).size > 0
                        ? member.roles.cache
                            .filter(r => r.id !== message.guild.id)
                            .map(r => r)
                            .join(", ")
                        : "لا يمتلك أي رتبة",
                inline: false,
            },
        )
        .setFooter({ text: `طلب بواسطة ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

    message.reply({ embeds: [embed] });
});
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (message.content == `${prefix}lock`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply("❌ انت مش معاك صلاحية `Manage Channels` عشان تستخدم الامر دا.");
        }

        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            SendMessages: false
        });
        message.channel.send("🔒 تم قفل الروم بنجاح.");
    }
})
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (message.content == `${prefix}unlock`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply("❌ انت مش معاك صلاحية `Manage Channels` عشان تستخدم الامر دا.");
        }

        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            SendMessages: true
        });

        message.channel.send("🔓 تم فتح الروم بنجاح.");
    }
})
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (message.content == `${prefix}hide`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply("❌ انت مش معاك صلاحية `Manage Channels` عشان تستخدم الامر دا.");
        }
        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            ViewChannel: false
        });
        message.channel.send("🙈 تم اخفاء الروم بنجاح.");
    }
})
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (message.content == `${prefix}show`) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply("❌ انت مش معاك صلاحية `Manage Channels` عشان تستخدم الامر دا.");
        }

        message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            ViewChannel: true
        });
        message.channel.send("🐵 تم اظهار الروم بنجاح.");
    }
})
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";

    if (!message.content.startsWith(`${prefix}timeout`)) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ مش معاك صلاحية تعمل تايم أوت.");
    const args = message.content.split(" ").slice(1);
    const member = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
    const time = args[1];
    const reason = args.slice(2).join(" ") || "بدون سبب";
    if (!member) return message.reply("⚠️ لازم تعمل منشن لعضو أو تكتب آيديه.");
    if (!time) return message.reply("⌛ حدد المدة (مثلاً: `10m`, `1h`, `2d`).");
    const ms = require("ms");
    const duration = ms(time);
    if (!duration || isNaN(duration)) return message.reply("❌ المدة غير صحيحة.");
    if (duration > 28 * 24 * 60 * 60 * 1000)
        return message.reply("❌ أقصى مدة تايم أوت هي 28 يوم.");
    try {
        await member.timeout(duration, reason);
        message.reply(`✅ تم عمل تايم أوت لـ ${member.user.tag} لمدة **${time}**.\n📄 السبب: ${reason}`);
    } catch (err) {
        console.error(err);
    }
});
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (!message.content.startsWith(`${prefix}untimeout`)) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ مش معاك صلاحية فك التايم أوت يا نجم.");

    const args = message.content.split(" ").slice(1);
    const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    const reason = args.slice(1).join(" ") || "بدون سبب";
    if (!member) return message.reply("⚠️ لازم تعمل منشن أو تكتب آيدي الشخص اللي عايز تفك عنه التايم أوت.");
    if (!member.communicationDisabledUntilTimestamp)
        return message.reply("ℹ️ الشخص دا مش عليه تايم أوت أصلاً.");
    try {
        await member.timeout(null, reason);
        message.reply(`✅ تم فك التايم أوت عن ${member.user.tag}.\n📄 السبب: ${reason}`);
    } catch (err) {
        console.error(err);
        message.reply("⚠️ حصل خطأ أثناء فك التايم أوت، تأكد إن البوت عنده صلاحية.");
    }
});
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (!message.content.startsWith(`${prefix}ban`)) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ مش معاك صلاحية بان يا نجم.");
    const args = message.content.split(" ").slice(1);
    const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    const reason = args.slice(1).join(" ") || "بدون سبب";

    if (!member) return message.reply("⚠️ لازم تعمل منشن أو تكتب آيدي الشخص اللي عايز تعمله بان.");
    if (!member.bannable) return message.reply("🚫 مش قادر أعمل بان للشخص دا، يمكن رتبته أعلى من البوت أو عنده صلاحيات.");
    try {
        await member.ban({ reason });
        message.reply(`✅ تم حظر ${member.user.tag} من السيرفر.\n📄 السبب: ${reason}`);
    } catch (err) {
        console.error(err);
    }
});
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";

    if (!message.content.endsWith(`${prefix}unban`)) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ مش معاك صلاحية فك البان يا نجم.");
    const args = message.content.split(" ").slice(1);
    const userId = args[0];
    const reason = args.slice(1).join(" ") || "بدون سبب";

    if (!userId) return message.reply("⚠️ لازم تكتب آيدي الشخص اللي عايز تفك عنه البان.");
    try {
        const bannedUsers = await message.guild.bans.fetch();
        const user = bannedUsers.get(userId);

        if (!user) return message.reply("❌ الشخص دا مش متبند أصلاً.");

        await message.guild.members.unban(userId, reason);
        message.reply(`✅ تم فك البان عن ${user.user.tag}.\n📄 السبب: ${reason}`);
    } catch (err) {
        console.error(err);
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";

    if (message.content !== `${prefix}unbanall`) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ مش معاك صلاحية فك البان يا نجم.");

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("confirm_unbanall")
            .setLabel("✅ فك البان عن الكل")
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId("cancel_unbanall")
            .setLabel("❌ إلغاء")
            .setStyle(ButtonStyle.Secondary)
    );

    const msg = await message.reply({
        content: "⚠️ هل انت متأكد إنك عايز تفك البان عن **كل الناس** المتبنده في السيرفر؟",
        components: [row],
    });

    const filter = (i) => i.user.id === message.author.id;
    const collector = msg.createMessageComponentCollector({ filter, time: 15000 });
    collector.on("collect", async (interaction) => {
        if (interaction.customId === "confirm_unbanall") {
            await interaction.deferReply({ ephemeral: true });
            try {
                const bans = await message.guild.bans.fetch();
                if (bans.size === 0) {
                    await interaction.editReply("✅ مفيش أي حد متبند.");
                    await msg.delete().catch(() => { });
                    return;
                }

                let count = 0;
                for (const ban of bans.values()) {
                    await message.guild.members.unban(ban.user.id, "Unban All Command");
                    count++;
                }

                await interaction.editReply(`✅ تم فك البان عن **${count}** شخص.`);
                await msg.delete().catch(() => { });
            } catch (err) {
                console.error(err);
                await interaction.editReply("⚠️ حصل خطأ أثناء فك البان عن الكل.");
            }
        } else if (interaction.customId === "cancel_unbanall") {
            await interaction.reply({ content: "❌ تم إلغاء العملية.", ephemeral: true });
            await msg.delete().catch(() => { });
        }
    });
    collector.on("end", async () => {
        if (!msg.delete) {
            msg.edit({ components: [] }).catch(() => { });
        }
    });
});
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (!message.content.startsWith(`${prefix}giverole`)) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
        return message.reply("❌ مش معاك صلاحية إدارة الرتب يا نجم.");

    const args = message.content.split(" ").slice(1);
    const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);

    if (!member) return message.reply("⚠️ لازم تعمل منشن أو تكتب آيدي الشخص.");
    if (!role) return message.reply("⚠️ لازم تعمل منشن أو تكتب آيدي الرول اللي عايز تديه.");
    if (role.position >= message.guild.members.me.roles.highest.position)
        return message.reply("🚫 الرول دا أعلى من أعلى رول عندي، مش هقدر أديه.");

    try {
        await member.roles.add(role);
        message.reply(`✅ تم إعطاء الرتبة ${role.name} لـ ${member.user.tag}`);
    } catch (err) {
        console.error(err);
        message.reply("⚠️ حصل خطأ أثناء محاولة إعطاء الرتبة.");
    }
});

client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;
    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (!message.content.startsWith(`${prefix}removerole`)) return;
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
        return message.reply("❌ مش معاك صلاحية إدارة الرتب يا نجم.");

    const args = message.content.split(" ").slice(1);
    const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
    const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);

    if (!member) return message.reply("⚠️ لازم تعمل منشن أو تكتب آيدي العضو.");
    if (!role) return message.reply("⚠️ لازم تعمل منشن أو تكتب آيدي الرتبة اللي عايز تشيلها.");
    if (!member.roles.cache.has(role.id))
        return message.reply("ℹ️ العضو دا مش عنده الرتبة دي أصلاً.");
    if (role.position >= message.guild.members.me.roles.highest.position)
        return message.reply("🚫 الرول دي أعلى من أعلى رول عندي، مش هقدر أشيلها.");

    try {
        await member.roles.remove(role);
        message.reply(`✅ تم إزالة الرتبة ${role.name} من ${member.user.tag}`);
    } catch (err) {
        console.error(err);
        message.reply("⚠️ حصل خطأ أثناء إزالة الرتبة.");
    }
});









































//Help Command
client.on(Events.MessageCreate, async message => {
    if (message.author.bot || !message.guild) return;

    const prefix = await db.get(`prefix_${message.guild.id}`) || "!";
    if (message.content === `${prefix}help`) {

        const embed = new EmbedBuilder()
            .setAuthor({ name: `${message.guild.name} Commands List`, iconURL: message.guild.iconURL({ dynamic: true }) })
            .setTitle("📜 قائمة أوامر البوت")
            .setDescription(`> استخدم \`${prefix}\` قبل كل أمر\n> مثال: \`${prefix}ping\`\n\n`)
            .addFields(
                {
                    name: "> ⚙️ أوامر عامة",
                    value: `
• \`${prefix}ping\` → اختبار سرعة استجابة البوت
• \`${prefix}serverinfo\` → عرض معلومات السيرفر
• \`${prefix}userinfo [@user|userID]\` → عرض معلومات عن عضو
                    `,
                    inline: false
                },
                {
                    name: "> 🔒 أوامر الإدارة",
                    value: `
• \`${prefix}lock\` → قفل الروم الحالي
• \`${prefix}unlock\` → فتح الروم الحالي
• \`${prefix}hide\` → إخفاء الروم الحالي
• \`${prefix}show\` → إظهار الروم الحالي
                    `,
                    inline: false
                },
                {
                    name: "> 🛠️ أوامر العقوبات",
                    value: `
• \`${prefix}timeout <@user> <time> [reason]\` → عمل تايم أوت لعضو
• \`${prefix}untimeout <@user> [reason]\` → فك التايم أوت
• \`${prefix}ban <@user> [reason]\` → حظر عضو
• \`${prefix}unban <userID> [reason]\` → فك الحظر
• \`${prefix}unbanall\` → فك الحظر عن كل الأعضاء
                    `,
                    inline: false
                },
                {
                    name: "> 🎭 أوامر الرتب",
                    value: `
• \`${prefix}giverole <@user> <@role>\` → إعطاء رتبة لعضو
• \`${prefix}removerole <@user> <@role>\` → إزالة رتبة من عضو
                    `,
                    inline: false
                },
                {
                    name: "> 🎫 أوامر التذاكر",
                    value: `
• افتح تذكرة عن طريق زر الشراء في منشورات العروض
• \`برمجه\` - للحصول على معلومات عن البرمجة
• \`تحويل\` - للحصول على معلومات عن التحويل
• \`تقييم\` - للحصول على معلومات عن التقييم
• \`خمول\` - للحصول على معلومات عن الخمول
• \`تصاميم\` - للحصول على معلومات عن التصاميم
                    `,
                    inline: false
                }
            )
            .setColor("Blurple")
            .setThumbnail(message.client.user.displayAvatarURL({ dynamic: true }))
            .setFooter({
                text: `Requested by ${message.author.tag}`,
                iconURL: message.author.displayAvatarURL({ dynamic: true })
            })
            .setTimestamp();

        message.channel.send({ embeds: [embed] });
    }
});
