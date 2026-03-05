import { marked, type Tokens } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";

const EMOJI_MAP: Record<string, string> = {
    ":smile:": "😄",
    ":laughing:": "😆",
    ":blush:": "😊",
    ":heart_eyes:": "😍",
    ":heart:": "❤️",
    ":thumbsup:": "👍",
    ":thumbsdown:": "👎",
    ":fire:": "🔥",
    ":rocket:": "🚀",
    ":eyes:": "👀",
    ":brain:": "🧠",
    ":check:": "✅",
    ":x:": "❌",
    ":warning:": "⚠️",
    ":info:": "ℹ️",
    ":question:": "❓",
    ":star:": "⭐",
    ":sparkles:": "✨",
    ":zap:": "⚡",
    ":rainbow:": "🌈",
    ":sun:": "☀️",
    ":moon:": "🌙",
    ":cloud:": "☁️",
    ":bolt:": "⚡",
    ":trophy:": "🏆",
    ":medal:": "🎖️",
    ":crown:": "👑",
    ":gem:": "💎",
    ":bell:": "🔔",
    ":flag:": "🚩",
    ":bookmark:": "🔖",
    ":link:": "🔗",
    ":pencil:": "✏️",
    ":memo:": "📝",
    ":calendar:": "📅",
    ":clock:": "🕐",
    ":hourglass:": "⏳",
    ":alarm:": "⏰",
    ":bulb:": "💡",
    ":money:": "💰",
    ":chart:": "📊",
    ":key:": "🔑",
    ":lock:": "🔒",
    ":unlock:": "🔓",
    ":phone:": "📱",
    ":computer:": "💻",
    ":tv:": "📺",
    ":camera:": "📷",
    ":film:": "🎬",
    ":music:": "🎵",
    ":guitar:": "🎸",
    ":piano:": "🎹",
    ":headphones:": "🎧",
    ":microphone:": "🎤",
    ":gift:": "🎁",
    ":tada:": "🎉",
    ":party:": "🎊",
    ":cookie:": "🍪",
    ":cake:": "🎂",
    ":pizza:": "🍕",
    ":burger:": "🍔",
    ":fries:": "🍟",
    ":coffee:": "☕",
    ":tea:": "🍵",
    ":beer:": "🍺",
    ":wine:": "🍷",
    ":cocktail:": "🍸",
    ":fork_and_knife:": "🍴",
    ":bread:": "🍞",
    ":egg:": "🥚",
    ":meat:": "🍖",
    ":poultry_leg:": "🍗",
    ":sushi:": "🍣",
    ":shrimp:": "🍤",
    ":fish_cake:": "🍥",
    ":doughnut:": "🍩",
    ":icecream:": "🍦",
    ":popcorn:": "🍿",
    ":peanuts:": "🥜",
    ":honey_pot:": "🍯",
    ":milk:": "🥛",
    ":salt:": "🧂",
    ":eggplant:": "🍆",
    ":tomato:": "🍅",
    ":corn:": "🌽",
    ":carrot:": "🥕",
    ":grapes:": "🍇",
    ":watermelon:": "🍉",
    ":lemon:": "🍋",
    ":banana:": "🍌",
    ":apple:": "🍎",
    ":peach:": "🍑",
    ":cherries:": "🍒",
    ":strawberry:": "🍓",
    ":kiwi:": "🥝",
    ":avocado:": "🥑",
    ":broccoli:": "🥦",
    ":mushroom:": "🍄",
    ":chestnut:": "🌰",
    ":croissant:": "🥐",
    ":baguette:": "🥖",
    ":pretzel:": "🥨",
    ":pancakes:": "🥞",
    ":waffle:": "🧇",
    ":cheese:": "🧀",
    ":sandwich:": "🥪",
    ":taco:": "🌮",
    ":burrito:": "🌯",
    ":salad:": "🥗",
    ":shallow_pan_of_food:": "🥘",
    ":stew:": "🍲",
    ":cup_soup:": "🍵",
    ":pot_of_food:": "🍲",
    ":pineapple:": "🍍",
    ":mango:": "🥭",
    ":fish:": "🐟",
    ":whale:": "🐋",
    ":dolphin:": "🐬",
    ":octopus:": "🐙",
    ":shell:": "🐚",
    ":crab:": "🦀",
    ":lobster:": "🦞",
    ":boat:": "⛵",
    ":speedboat:": "🚤",
    ":ship:": "🚢",
    ":airplane:": "✈️",
    ":art:": "🎨",
    ":dart:": "🎯",
    ":crystal_ball:": "🔮",
    ":video_game:": "🎮",
    ":slot_machine:": "🎰",
    ":game_die:": "🎲",
    ":jigsaw:": "🧩",
    ":musical_note:": "🎵",
    ":notes:": "🎶",
    ":trumpet:": "🎺",
    ":saxophone:": "🎷",
    ":violin:": "🎻",
    ":clapper:": "🎬",
    ":ticket:": "🎫",
    ":soccer:": "⚽",
    ":baseball:": "⚾",
    ":basketball:": "🏀",
    ":volleyball:": "🏐",
    ":football:": "🏈",
    ":tennis:": "🎾",
    ":bowling:": "🎳",
    ":ski:": "🎿",
    ":swimmer:": "🏊",
    ":surfer:": "🏄",
    ":horse_racing:": "🏇",
    ":bath:": "🛀",
    ":zzz:": "💤",
    ":two_hearts:": "💕",
    ":heartbeat:": "💗",
    ":sparkling_heart:": "💖",
    ":heart_exclamation:": "❣️",
    ":love_letter:": "💌",
    ":revolving_hearts:": "💞",
    ":purple_heart:": "💜",
    ":blue_heart:": "💙",
    ":green_heart:": "💚",
    ":yellow_heart:": "💛",
    ":orange_heart:": "🧡",
    ":black_heart:": "🖤",
    ":broken_heart:": "💔",
    ":white_check_mark:": "✅",
    ":exclamation:": "❗",
    ":no_entry:": "⛔",
    ":prohibited:": "🚫",
    ":radio_button:": "🔘",
    ":white_circle:": "⚪",
    ":black_circle:": "⚫",
    ":red_circle:": "🔴",
    ":blue_circle:": "🔵",
    ":arrow_up:": "⬆️",
    ":arrow_down:": "⬇️",
    ":arrow_left:": "⬅️",
    ":arrow_right:": "➡️",
    ":arrow_up_down:": "↕️",
    ":arrow_left_right:": "↔️",
    ":left_right_arrow:": "↔️",
    ":arrow_up_small:": "🔼",
    ":arrow_down_small:": "🔽",
    ":left_arrow:": "⬅️",
    ":right_arrow:": "➡️",
    ":up_arrow:": "⬆️",
    ":down_arrow:": "⬇️",
    ":on:": "🔛",
    ":soon:": "🔜",
    ":top:": "🔝",
    ":end:": "🔚",
    ":back:": "🔙",
    ":forward:": "🔜",
    ":return:": "🔙",
    ":collision:": "💥",
    ":dizzy:": "💫",
    ":boom:": "💥",
    ":sweat_drops:": "💦",
    ":droplet:": "💧",
    ":dash:": "💨",
    ":sweat:": "😓",
    ":dashing_away:": "💨",
    ":ear:": "👂",
    ":eye:": "👁️",
    ":nose:": "👃",
    ":tongue:": "👅",
    ":lips:": "👄",
    ":hand:": "✋",
    ":raised_hand:": "✋",
    ":hand_splayed:": "🖐️",
    ":metal:": "🤘",
    ":peace:": "✌️",
    ":v:": "✌️",
    ":crossed_fingers:": "🤞",
    ":handshake:": "🤝",
    ":thumbs_up:": "👍",
    ":thumbs_down:": "👎",
    ":punch:": "👊",
    ":fist:": "✊",
    ":wave:": "👋",
    ":raised_back_of_hand:": "🤚",
    ":muscle:": "💪",
    ":middle_finger:": "🖕",
    ":point_up:": "☝️",
    ":point_down:": "👇",
    ":point_left:": "👈",
    ":point_right:": "👉",
    ":raised_hands:": "🙌",
    ":pray:": "🙏",
    ":nail_care:": "💅",
    ":ring:": "💍",
    ":lipstick:": "💄",
    ":kiss:": "💋",
    ":lips_sealed:": "😬",
    ":tongue_out:": "😛",
    ":wink:": "😉",
    ":stuck_out_tongue_winking_eye:": "😜",
    ":stuck_out_tongue_closed_eyes:": "😝",
    ":stuck_out_tongue:": "😜",
    ":thermometer_face:": "🤒",
    ":head_bandage:": "🤕",
    ":nauseated_face:": "🤢",
    ":face_vomiting:": "🤮",
    ":sneezing_face:": "🤧",
    ":mask:": "😷",
    ":woozy_face:": "🥴",
    ":dizzy_face:": "😵",
    ":exploding_head:": "🤯",
    ":face_with_cowboy_hat:": "🤠",
    ":partying_face:": "🥳",
    ":sunglasses_cool:": "😎",
    ":nerd_face:": "🤓",
    ":confused_face:": "😕",
    ":worried_face:": "😟",
    ":slightly_frowning_face:": "🙁",
    ":frowning_face:": "☹️",
    ":face_with_steam_from_nose:": "😤",
    ":pensive_face:": "😔",
    ":confounded_face:": "😖",
    ":sleepy_face:": "😪",
    ":sleeping_face:": "😴",
    ":drooling_face:": "🤤",
    ":astonished_face:": "😲",
    ":flushed_face:": "😳",
    ":anguished_face:": "😱",
    ":fearful_face:": "😨",
    ":face_with_open_mouth:": "😮",
    ":hushed_face:": "😯",
    ":face_with_raised_eyebrow:": "🤨",
    ":neutral_face:": "😐",
    ":expressionless_face:": "😑",
    ":unamused_face:": "😒",
    ":face_with_rolling_eyes:": "🙄",
    ":grimacing_face:": "😬",
    ":lying_face:": "🤥",
    ":pensive:": "😔",
    ":sleepy:": "😪",
    ":sick:": "😷",
    ":face_exhaling:": "😮‍💨",
    ":face_with_spiral_eyes:": "😵‍💫",
    ":shushing_face:": "🤫",
};

function replaceEmojis(text: string): string {
    let result = text;
    for (const [emoji, char] of Object.entries(EMOJI_MAP)) {
        const escaped = emoji.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&");
        result = result.replace(new RegExp(escaped, "g"), char);
    }
    return result;
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function processReasoningBlocks(text: string): string {
    const patterns = [
        /<thinking>([\s\S]*?)<\/thinking>/gi,
        /<think>([\s\S]*?)<\/think>/gi,
        /<reasoning>([\s\S]*?)<\/reasoning>/gi,
        /<analysis>([\s\S]*?)<\/analysis>/gi,
        /<text_quality>([\s\S]*?)<\/text_quality>/gi,
        /<chain_of_thought>([\s\S]*?)<\/chain_of_thought>/gi,
        /<cot>([\s\S]*?)<\/cot>/gi,
    ];

    let result = text;

    for (const pattern of patterns) {
        result = result.replace(pattern, (_match, content) => {
            const trimmed = content ? content.trim() : "";
            if (!trimmed) return "";
            const charCount = trimmed.length;
            const escapedContent = escapeHtml(trimmed);
            return (
                '<details class="reasoning-block">' +
                '<summary class="reasoning-header">' +
                '<span class="reasoning-icon">👉🏻</span>' +
                "Reasoning" +
                '<span class="reasoning-length">(' +
                charCount +
                " chars)</span>" +
                "</summary>" +
                '<div class="reasoning-content">' +
                escapedContent +
                "</div>" +
                "</details>"
            );
        });
    }

    return result;
}

function replaceLatex(text: string): string {
    let result = text;
    result = result.replace(
        /\\$([^$]+)\\$/g,
        '<span class="latex-inline">$1</span>',
    );
    result = result.replace(
        /\$\$([^$]+)\$\$/g,
        '<div class="latex-block">$1</div>',
    );

    return result;
}

function configureMarked(): void {
    const renderer = new marked.Renderer();

    renderer.code = ({ text, lang }: Tokens.Code) => {
        const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
        const highlighted = hljs.highlight(text, { language }).value;
        return (
            '<pre class="hljs-code-block"><code class="hljs language-' +
            language +
            '">' +
            highlighted +
            "</code></pre>"
        );
    };

    renderer.codespan = ({ text }: Tokens.Codespan) => {
        return '<code class="inline-code">' + escapeHtml(text) + "</code>";
    };

    marked.use({
        renderer,
        breaks: true,
        gfm: true,
    });
}

configureMarked();

export function renderMarkdown(content: string): string {
    let processed = replaceEmojis(content);
    processed = processReasoningBlocks(processed);
    processed = replaceLatex(processed);

    const html = marked.parse(processed) as string;

    return DOMPurify.sanitize(html, {
        ADD_TAGS: ["pre", "code", "span", "div", "details", "summary"],
        ADD_ATTR: ["class", "open"],
    });
}
