
const { Client, GatewayIntentBits, Events, EmbedBuilder, PermissionsBitField } = require('discord.js');


const CONFIG = {
    TOKEN: '', // Thay thế bằng token bot của bạn
    OWNER_ID: '', // Thay thế bằng ID Discord của bạn để nhận log
    MAX_CHANNELS_PER_MINUTE: 4, // Tối đa 4 kênh tạo trong 1 phút
    TIME_WINDOW: 60000, 
    
 
    WHITELISTED_BOTS: [
        '',
  
     
    ]
};


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildWebhooks
    ]
});


const channelCreationTracker = new Map(); 
const kickedBots = new Set(); 
const botStats = {
    startTime: Date.now(),
    totalKicks: 0,
    totalWebhooksDeleted: 0,
    everyoneSpamBlocked: 0,
    channelSpamBlocked: 0
};

// Utility functions
function isBot(user) {
    return user.bot;
}

function isWhitelisted(botId) {
    return CONFIG.WHITELISTED_BOTS.includes(botId);
}

function sendLogToOwner(embed) {
    client.users.fetch(CONFIG.OWNER_ID)
        .then(owner => {
            owner.send({ embeds: [embed] })
                .catch(err => console.error('Không thể gửi log cho owner:', err));
        })
        .catch(err => console.error('Không thể tìm owner:', err));
}

function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

async function deleteAllWebhooks(guild) {
    try {
        const webhooks = await guild.fetchWebhooks();
        const deletePromises = webhooks.map(webhook => 
            webhook.delete().catch(err => 
                console.error(`Không thể xóa webhook ${webhook.name}:`, err)
            )
        );
        await Promise.all(deletePromises);
        botStats.totalWebhooksDeleted += webhooks.size;
        return webhooks.size;
    } catch (error) {
        console.error('Lỗi khi xóa webhooks:', error);
        return 0;
    }
}

async function kickBot(guild, bot, reason) {
    try {
        const member = await guild.members.fetch(bot.id);
        if (member.kickable) {
            await member.kick(reason);
            botStats.totalKicks++;
            return true;
        } else {
            console.log(`Không thể kick bot ${bot.tag} (thiếu quyền)`);
            return false;
        }
    } catch (error) {
        console.error(`Lỗi khi kick bot ${bot.tag}:`, error);
        return false;
    }
}


client.once(Events.ClientReady, () => {
    console.log(` Bot ${client.user.tag} đã sẵn sàng!`);
    console.log(`Anti-raid system đang hoạt động`);
    console.log(` Đang bảo vệ ${client.guilds.cache.size} server(s)`);
    console.log(` Có ${CONFIG.WHITELISTED_BOTS.length} bot trong whitelist`);
    
 
    client.user.setActivity(`🛡️ Bảo vệ ${client.guilds.cache.size} servers`, { 
        type: 'WATCHING' 
    });
});


client.on(Events.ChannelCreate, async (channel) => {
    const guild = channel.guild;
    if (!guild) return;


    try {
        const auditLogs = await guild.fetchAuditLogs({
            type: 10, 
            limit: 1
        });

        const auditEntry = auditLogs.entries.first();
        if (!auditEntry) return;

        const executor = auditEntry.executor;
        if (!isBot(executor)) return; 

       
        if (isWhitelisted(executor.id)) {
            console.log(`✅ Bot ${executor.tag} được phép tạo kênh (whitelisted)`);
            return;
        }

        const now = Date.now();
        const userId = executor.id;

        
        if (!channelCreationTracker.has(userId)) {
            channelCreationTracker.set(userId, []);
        }

        const userActions = channelCreationTracker.get(userId);
        
       
        const recentActions = userActions.filter(timestamp => 
            now - timestamp < CONFIG.TIME_WINDOW
        );
        
 
        recentActions.push(now);
        channelCreationTracker.set(userId, recentActions);

     
        if (recentActions.length > CONFIG.MAX_CHANNELS_PER_MINUTE) {
            if (!kickedBots.has(userId)) {
                kickedBots.add(userId);
                botStats.channelSpamBlocked++;
                
               
                const kicked = await kickBot(guild, executor, 'Anti-raid: Tạo quá nhiều kênh');
                
               
                const webhooksDeleted = await deleteAllWebhooks(guild);
                
            
                const logEmbed = new EmbedBuilder()
                    .setColor(0x000000)
                    .setTitle('  ANTI-RAID ACTIVATED')
                    .setDescription('Phát hiện hành vi spam tạo kênh!')
                    .addFields(
                        { name: ' Bot bị kick', value: `${executor.tag} (${executor.id})`, inline: false },
                        { name: '  Server', value: `${guild.name} (${guild.id})`, inline: false },
                        { name: '  Số kênh tạo', value: `${recentActions.length} kênh trong 1 phút`, inline: true },
                        { name: '  Hành động', value: kicked ? '✅ Đã kick bot' : '❌ Không thể kick', inline: true },
                        { name: ' Webhooks', value: `Đã xóa ${webhooksDeleted} webhooks`, inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Anti-Raid System' });

                sendLogToOwner(logEmbed);

                console.log(` Kicked bot ${executor.tag} for spam creating channels in ${guild.name}`);
                
              
                setTimeout(() => {
                    kickedBots.delete(userId);
                    channelCreationTracker.delete(userId);
                }, 300000);
            }
        }
    } catch (error) {
        console.error('Lỗi khi kiểm tra audit log:', error);
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.id !== CONFIG.OWNER_ID) return;
    
 
    if (message.content === '?status') {
        const uptime = Date.now() - botStats.startTime;
        const guilds = client.guilds.cache;
        let totalMembers = 0;
        let totalBots = 0;
        
        guilds.forEach(guild => {
            totalMembers += guild.memberCount || 0;
            
            totalBots += Math.floor((guild.memberCount || 0) * 0.1);
        });

        const statusEmbed = new EmbedBuilder()
            .setColor(0x000000)
            .setTitle('Anti-Raid System Status')
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '  Uptime', value: formatUptime(uptime), inline: true },
                { name: ' Servers được bảo vệ', value: `${guilds.size}`, inline: true },
                { name: 'Tổng thành viên', value: `${totalMembers.toLocaleString()}`, inline: true },
                { name: '  Bot đã kick', value: `${botStats.totalKicks}`, inline: true },
                { name: '  Webhooks đã xóa', value: `${botStats.totalWebhooksDeleted}`, inline: true },
                { name: '  @every spam chặn', value: `${botStats.everyoneSpamBlocked}`, inline: true },
                { name: '  Channel spam chặn', value: `${botStats.channelSpamBlocked}`, inline: true },
                { name: ' Bot trong whitelist', value: `${CONFIG.WHITELISTED_BOTS.length}`, inline: true },
                { name: ' Cấu hình', value: `Max ${CONFIG.MAX_CHANNELS_PER_MINUTE} kênh/phút`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Bot ID: ${client.user.id}` });

        return message.reply({ embeds: [statusEmbed] });
    }

    switch (command.toLowerCase()) {
        case 'add':
            if (!botId || !/^\d{17,19}$/.test(botId)) {
                return message.reply(' Vui lòng cung cấp ID bot hợp lệ!');
            }
            
            if (CONFIG.WHITELISTED_BOTS.includes(botId)) {
                return message.reply(' Bot này đã có trong whitelist!');
            }
            
            try {
                const bot = await client.users.fetch(botId);
                if (!bot.bot) {
                    return message.reply(' ID này không phải là bot!');
                }
                
                CONFIG.WHITELISTED_BOTS.push(botId);
                const embed = new EmbedBuilder()
                    .setColor(0x00ff00)
                    .setTitle(' Đã thêm vào whitelist')
                    .setDescription(`Bot **${bot.tag}** (${botId}) đã được thêm vào whitelist`)
                    .setThumbnail(bot.displayAvatarURL())
                    .setTimestamp();
                
                message.reply({ embeds: [embed] });
                console.log(` Added ${bot.tag} to whitelist`);
            } catch (error) {
                message.reply(' Không thể tìm thấy bot với ID này!');
            }
            break;

        case 'remove':
            if (!botId) {
                return message.reply(' Vui lòng cung cấp ID bot!');
            }
            
            const index = CONFIG.WHITELISTED_BOTS.indexOf(botId);
            if (index === -1) {
                return message.reply(' Bot này không có trong whitelist!');
            }
            
            CONFIG.WHITELISTED_BOTS.splice(index, 1);
            const embed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle(' Đã xóa khỏi whitelist')
                .setDescription(`Bot ID **${botId}** đã được xóa khỏi whitelist`)
                .setTimestamp();
            
            message.reply({ embeds: [embed] });
            console.log(` Removed bot ${botId} from whitelist`);
            break;

        case 'list':
            if (CONFIG.WHITELISTED_BOTS.length === 0) {
                return message.reply(' Whitelist hiện tại trống!');
            }
            
            const listEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle('Danh sách Whitelist')
                .setDescription(`Có **${CONFIG.WHITELISTED_BOTS.length}** bot trong whitelist:`)
                .setTimestamp();
            
            let botList = '';
            for (let i = 0; i < CONFIG.WHITELISTED_BOTS.length; i++) {
                try {
                    const bot = await client.users.fetch(CONFIG.WHITELISTED_BOTS[i]);
                    botList += `${i + 1}. **${bot.tag}** (${CONFIG.WHITELISTED_BOTS[i]})\n`;
                } catch {
                    botList += `${i + 1}. **Unknown Bot** (${CONFIG.WHITELISTED_BOTS[i]})\n`;
                }
            }
            
            listEmbed.addFields({ name: 'Bots:', value: botList || 'Không có bot nào', inline: false });
            message.reply({ embeds: [listEmbed] });
            break;

        case 'clear':
            const count = CONFIG.WHITELISTED_BOTS.length;
            CONFIG.WHITELISTED_BOTS.length = 0;
            
            const clearEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setTitle('🧹 Đã xóa toàn bộ whitelist')
                .setDescription(`Đã xóa **${count}** bot khỏi whitelist`)
                .setTimestamp();
            
            message.reply({ embeds: [clearEmbed] });
            console.log(`🧹 Cleared whitelist (${count} bots removed)`);
            break;

        default:
            message.reply('❌ Lệnh không hợp lệ! Sử dụng `!antiraid` để xem danh sách lệnh.');
    }
});


client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || !isBot(message.author)) return;
    
    // Check if bot is whitelisted
    if (isWhitelisted(message.author.id)) {
        return; 
    }
    
    
    if (message.mentions.everyone) {
        try {
            botStats.everyoneSpamBlocked++;
       
            await message.delete();
            
        
            const kicked = await kickBot(message.guild, message.author, 'Anti-raid: Spam @everyone');
            
            
            const webhooksDeleted = await deleteAllWebhooks(message.guild);
            
           
            const logEmbed = new EmbedBuilder()
                .setColor(0xff4500)
                .setTitle(' ANTI-RAID ACTIVATED')
                .setDescription('Phát hiện bot spam @everyone!')
                .addFields(
                    { name: ' Bot bị kick', value: `${message.author.tag} (${message.author.id})`, inline: false },
                    { name: ' Server', value: `${message.guild.name} (${message.guild.id})`, inline: false },
                    { name: ' Kênh', value: `${message.channel.name} (${message.channel.id})`, inline: false },
                    { name: ' Nội dung', value: message.content.substring(0, 200) + (message.content.length > 200 ? '...' : ''), inline: false },
                    { name: ' Hành động', value: kicked ? '✅ Đã kick bot' : '❌ Không thể kick', inline: true },
                    { name: ' Webhooks', value: `Đã xóa ${webhooksDeleted} webhooks`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Anti-Raid System' });

            sendLogToOwner(logEmbed);
            
            console.log(`🚨 Kicked bot ${message.author.tag} for @everyone spam in ${message.guild.name}`);
            
        } catch (error) {
            console.error('Lỗi khi xử lý tin nhắn @everyone:', error);
        }
    }
});


client.on(Events.Error, error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});


client.login(CONFIG.TOKEN);


module.exports = { client, CONFIG };
