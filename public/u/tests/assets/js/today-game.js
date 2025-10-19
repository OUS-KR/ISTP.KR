// today-game.js - ISTP - 만능 해결사의 작업실 (The All-Rounder's Workshop)

// --- Utility Functions ---
function getDailySeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function getRandomValue(base, variance) {
    const min = base - variance;
    const max = base + variance;
    return Math.floor(currentRandFn() * (max - min + 1)) + min;
}

function getEulReParticle(word) {
    if (!word || word.length === 0) return "를";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "와";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "와";
    return (uni - 0xAC00) % 28 > 0 ? "과" : "와";
}

// --- Game State Management ---
let gameState = {};
let currentRandFn = null;

function resetGameState() {
    gameState = {
        day: 1,
        logic: 50,
        efficiency: 50,
        skill: 50,
        adaptation: 50,
        concentration: 50,
        actionPoints: 10, // Represents '집중력'
        maxActionPoints: 10,
        resources: { parts: 10, materials: 10, energy: 5, rare_parts: 0 },
        assistants: [
            { id: "macgyver", name: "맥가이버", personality: "호기심 많은", skill: "회로 분석", reliability: 70 },
            { id: "neo", name: "네오", personality: "침착한", skill: "기계 조립", reliability: 60 }
        ],
        maxAssistants: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { craftSuccess: 0 },
        dailyActions: { tinkered: false, reviewed: false, chattedWith: [], minigamePlayed: false },
        tools: {
            toolbox: { built: false, durability: 100, name: "공구함", description: "기본적인 수리를 위한 필수 도구 세트입니다.", effect_description: "부품 자동 생성 및 기술 보너스." },
            workbench: { built: false, durability: 100, name: "작업대", description: "본격적인 제작 및 분해 작업을 시작합니다.", effect_description: "재료 생성 및 효율 향상." },
            blueprintStorage: { built: false, durability: 100, name: "설계도 보관소", description: "복잡한 발명품의 설계도를 보관합니다.", effect_description: "새로운 조수 영입 및 논리 강화." },
            weldingMachine: { built: false, durability: 100, name: "용접기", description: "금속 부품을 결합하여 더 견고한 장치를 만듭니다.", effect_description: "과거 기록을 통해 스탯 및 자원 획득." },
            cncMachine: { built: false, durability: 100, name: "CNC 머신", description: "컴퓨터 제어로 정밀한 부품을 가공합니다.", effect_description: "희귀 부품 획득 및 고급 제작 잠금 해제." }
        },
        workshopLevel: 0,
        minigameState: {}
    };
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
}

function saveGameState() {
    localStorage.setItem('istpWorkshopGame', JSON.stringify(gameState));
}

function loadGameState() {
    const savedState = localStorage.getItem('istpWorkshopGame');
    const today = new Date().toISOString().slice(0, 10);
    if (savedState) {
        let loaded = JSON.parse(savedState);
        if (!loaded.dailyBonus) loaded.dailyBonus = { craftSuccess: 0 };
        if (!loaded.tools) {
            loaded.tools = {
                toolbox: { built: false, durability: 100, name: "공구함" },
                workbench: { built: false, durability: 100, name: "작업대" },
                blueprintStorage: { built: false, durability: 100, name: "설계도 보관소" },
                weldingMachine: { built: false, durability: 100, name: "용접기" },
                cncMachine: { built: false, durability: 100, name: "CNC 머신" }
            };
        }
        Object.assign(gameState, loaded);

        currentRandFn = mulberry32(getDailySeed() + gameState.day);

        if (gameState.lastPlayedDate !== today) {
            gameState.day += 1;
            gameState.lastPlayedDate = today;
            gameState.manualDayAdvances = 0;
            gameState.dailyEventTriggered = false;
            processDailyEvents();
        }
    } else {
        resetGameState();
        processDailyEvents();
    }
    renderAll();
}

function updateState(changes, displayMessage = null) {
    Object.keys(changes).forEach(key => {
        if (typeof changes[key] === 'object' && changes[key] !== null && !Array.isArray(changes[key])) {
            gameState[key] = { ...gameState[key], ...changes[key] };
        } else {
            gameState[key] = changes[key];
        }
    });
    saveGameState();
    renderAll(displayMessage);
}

// --- UI Rendering ---
function updateGameDisplay(text) {
    const gameArea = document.getElementById('gameArea');
    if(gameArea && text) gameArea.innerHTML = `<p>${text.replace(/\n/g, '<br>')}</p>`;
}

function renderStats() {
    const statsDiv = document.getElementById('gameStats');
    if (!statsDiv) return;
    const assistantListHtml = gameState.assistants.map(a => `<li>${a.name} (${a.skill}) - 신뢰도: ${a.reliability}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>${gameState.day}일차 작업</b></p>
        <p><b>집중력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>논리:</b> ${gameState.logic} | <b>효율:</b> ${gameState.efficiency} | <b>기술:</b> ${gameState.skill} | <b>적응력:</b> ${gameState.adaptation} | <b>집중력:</b> ${gameState.concentration}</p>
        <p><b>자원:</b> 부품 ${gameState.resources.parts}, 재료 ${gameState.resources.materials}, 에너지 ${gameState.resources.energy}, 희귀 부품 ${gameState.resources.rare_parts || 0}</p>
        <p><b>작업실 레벨:</b> ${gameState.workshopLevel}</p>
        <p><b>나의 조수 (${gameState.assistants.length}/${gameState.maxAssistants}):</b></p>
        <ul>${assistantListHtml}</ul>
        <p><b>보유 도구:</b></p>
        <ul>${Object.values(gameState.tools).filter(t => t.built).map(t => `<li>${t.name} (내구성: ${t.durability})</li>`).join('') || '없음'}</ul>
    `;
    const manualDayCounter = document.getElementById('manualDayCounter');
    if(manualDayCounter) manualDayCounter.innerText = gameState.manualDayAdvances;
}

function renderChoices(choices) {
    const choicesDiv = document.getElementById('gameChoices');
    if (!choicesDiv) return;
    let dynamicChoices = [];

    if (gameState.currentScenarioId === 'intro') {
        dynamicChoices = gameScenarios.intro.choices;
    } else if (gameState.currentScenarioId === 'action_tool_management') {
        dynamicChoices = [];
        if (!gameState.tools.toolbox.built) dynamicChoices.push({ text: "공구함 구매 (재료 50, 에너지 20)", action: "build_toolbox" });
        if (!gameState.tools.workbench.built) dynamicChoices.push({ text: "작업대 제작 (에너지 30, 재료 30)", action: "build_workbench" });
        if (!gameState.tools.blueprintStorage.built) dynamicChoices.push({ text: "설계도 보관소 구축 (재료 100, 에너지 50)", action: "build_blueprintStorage" });
        if (!gameState.tools.weldingMachine.built) dynamicChoices.push({ text: "용접기 구매 (에너지 80, 재료 40)", action: "build_weldingMachine" });
        if (gameState.tools.workbench.built && !gameState.tools.cncMachine.built) {
            dynamicChoices.push({ text: "CNC 머신 설치 (에너지 150, 희귀 부품 5)", action: "build_cncMachine" });
        }
        Object.keys(gameState.tools).forEach(key => {
            const tool = gameState.tools[key];
            if (tool.built && tool.durability < 100) {
                dynamicChoices.push({ text: `${tool.name} 수리 (에너지 10, 재료 10)`, action: "maintain_tool", params: { tool: key } });
            }
        });
        dynamicChoices.push({ text: "취소", action: "return_to_intro" });
    } else {
        dynamicChoices = choices ? [...choices] : [];
    }

    choicesDiv.innerHTML = dynamicChoices.map(choice => `<button class="choice-btn" data-action="${choice.action}" data-params='${JSON.stringify(choice.params || {})}'>${choice.text}</button>`).join('');
    choicesDiv.querySelectorAll('.choice-btn').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            if (gameActions[action]) {
                gameActions[action](JSON.parse(button.dataset.params || '{}'));
            }
        });
    });
}

function renderAll(customDisplayMessage = null) {
    const desc = document.getElementById('gameDescription');
    if (desc) desc.style.display = 'none';
    renderStats();
    
    if (!gameState.currentScenarioId.startsWith('minigame_')) {
        const scenario = gameScenarios[gameState.currentScenarioId] || gameScenarios.intro;
        updateGameDisplay(customDisplayMessage || scenario.text);
        renderChoices(scenario.choices);
    }
}

// --- Game Data (ISTP Themed) ---
const gameScenarios = {
    "intro": { text: "오늘은 작업실에서 무엇을 할까요?", choices: [
        { text: "작업실 둘러보기", action: "tinker" },
        { text: "조수와 대화", action: "chat_with_assistant" },
        { text: "프로젝트 검토", action: "review_project" },
        { text: "부품 수집", action: "show_resource_gathering_options" },
        { text: "도구 관리", action: "show_tool_management_options" },
        { text: "즉흥 제작", action: "show_impromptu_crafting_options" },
        { text: "오늘의 과제", action: "play_minigame" }
    ]},
    "action_resource_gathering": {
        text: "어떤 부품을 수집하시겠습니까?",
        choices: [
            { text: "부품 수집", action: "gather_parts" },
            { text: "재료 가공", action: "process_materials" },
            { text: "에너지 충전", action: "charge_energy" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    "action_tool_management": { text: "어떤 도구를 관리하시겠습니까?", choices: [] },
    "impromptu_crafting_menu": {
        text: "무엇을 즉흥적으로 제작하시겠습니까?",
        choices: [
            { text: "쓸모없는 기계 (집중력 1 소모)", action: "craft_useless_machine" },
            { text: "드론 개조 (집중력 1 소모)", action: "modify_drone" },
            { text: "취소", action: "return_to_intro" }
        ]
    },
    // Game Over Scenarios
    "game_over_logic": { text: "논리적 오류로 작업실에 큰 폭발이 일어났습니다. 모든 것을 잃었습니다.", choices: [], final: true },
    "game_over_efficiency": { text: "비효율적인 작업 방식으로 인해 모든 프로젝트가 실패했습니다.", choices: [], final: true },
    "game_over_skill": { text: "기술 부족으로 더 이상 복잡한 장치를 다룰 수 없습니다.", choices: [], final: true },
    "game_over_resources": { text: "작업실을 운영할 자원이 모두 소진되었습니다.", choices: [], final: true },
};

const tinkerOutcomes = [
    { weight: 30, condition: (gs) => gs.concentration > 60, effect: (gs) => { const v = getRandomValue(10, 5); return { changes: { skill: gs.skill + v }, message: `작업실을 둘러보다 새로운 기술을 연마했습니다! (+${v} 기술)` }; } },
    { weight: 25, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { adaptation: gs.adaptation + v }, message: `예상치 못한 문제를 해결하며 적응력이 상승했습니다. (+${v} 적응력)` }; } },
    { weight: 20, condition: () => true, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { resources: { ...gs.resources, parts: gs.resources.parts - v } }, message: `실수로 부품을 잃어버렸습니다. (-${v} 부품)` }; } },
    { weight: 15, condition: (gs) => gs.concentration < 40, effect: (gs) => { const v = getRandomValue(5, 2); return { changes: { efficiency: gs.efficiency - v }, message: `집중력이 흐트러져 작업 효율이 떨어집니다. (-${v} 효율)` }; } },
];

const chatOutcomes = [
    { weight: 40, condition: (gs, assistant) => assistant.reliability < 80, effect: (gs, assistant) => { const v = getRandomValue(10, 5); const updated = gs.assistants.map(a => a.id === assistant.id ? { ...a, reliability: Math.min(100, a.reliability + v) } : a); return { changes: { assistants: updated }, message: `${assistant.name}${getWaGwaParticle(assistant.name)}의 실용적인 대화로 신뢰도가 상승했습니다. (+${v} 신뢰도)` }; } },
    { weight: 30, condition: () => true, effect: (gs, assistant) => { const v = getRandomValue(5, 2); return { changes: { logic: gs.logic + v }, message: `${assistant.name}에게서 문제 해결의 실마리를 얻었습니다. (+${v} 논리)` }; } },
    { weight: 20, condition: (gs) => gs.efficiency < 40, effect: (gs, assistant) => { const v = getRandomValue(10, 3); const updated = gs.assistants.map(a => a.id === assistant.id ? { ...a, reliability: Math.max(0, a.reliability - v) } : a); return { changes: { assistants: updated }, message: `당신의 비효율적인 지시에 ${assistant.name}이(가) 불만을 표합니다. (-${v} 신뢰도)` }; } },
];

const reviewOutcomes = [
    { weight: 40, condition: (gs) => gs.logic > 60, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { efficiency: gs.efficiency + v }, message: `프로젝트의 논리적 허점을 발견하여 효율성을 개선했습니다. (+${v} 효율)` }; } },
    { weight: 30, condition: () => true, effect: (gs) => { const v = getRandomValue(10, 3); return { changes: { skill: gs.skill + v }, message: `프로젝트를 검토하며 새로운 기술을 습득했습니다. (+${v} 기술)` }; } },
    { weight: 20, condition: (gs) => gs.concentration < 40, effect: (gs) => { const v = getRandomValue(10, 4); return { changes: { adaptation: gs.adaptation - v }, message: `집중력 부족으로 프로젝트의 중요한 부분을 놓쳤습니다. (-${v} 적응력)` }; } },
];

const minigames = [
    {
        name: "회로 연결하기",
        description: "끊어진 회로를 올바르게 연결하여 장치를 작동시키세요.",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { score: 0, connections: [false, false, false], solution: [true, true, true] };
            minigames[0].render(gameArea, choicesDiv);
        },
        render: (gameArea, choicesDiv) => {
            const state = gameState.minigameState;
            gameArea.innerHTML = `<p>${minigames[0].description}</p><div id="circuit-board">${state.connections.map((c, i) => `<div class="wire ${c ? 'connected' : ''}" data-index="${i}"></div>`).join('')}</div>`;
            choicesDiv.innerHTML = ``;
            gameArea.querySelectorAll('.wire').forEach(wire => wire.addEventListener('click', () => minigames[0].processAction('toggle_wire', parseInt(wire.dataset.index))));
        },
        processAction: (actionType, value) => {
            if (actionType === 'toggle_wire') {
                const state = gameState.minigameState;
                state.connections[value] = !state.connections[value];
                minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                if (state.connections.every((v, i) => v === state.solution[i])) {
                    state.score = 100;
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({ logic: gameState.logic + rewards.logic, skill: gameState.skill + rewards.skill, currentScenarioId: 'intro' }, rewards.message);
        }
    },
];

function calculateMinigameReward(minigameName, score) {
    let rewards = { logic: 0, skill: 0, message: "" };
    if (score >= 100) { rewards.logic = 15; rewards.skill = 10; rewards.message = `완벽한 회로입니다! (+15 논리, +10 기술)`; } 
    else { rewards.logic = 5; rewards.message = `회로를 연결했습니다. (+5 논리)`; }
    return rewards;
}

function spendActionPoint() {
    if (gameState.actionPoints <= 0) { updateGameDisplay("집중력이 부족합니다."); return false; }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    tinker: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = tinkerOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    chat_with_assistant: () => {
        if (!spendActionPoint()) return;
        const assistant = gameState.assistants[Math.floor(currentRandFn() * gameState.assistants.length)];
        const possibleOutcomes = chatOutcomes.filter(o => !o.condition || o.condition(gameState, assistant));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState, assistant);
        updateState(result.changes, result.message);
    },
    review_project: () => {
        if (!spendActionPoint()) return;
        const possibleOutcomes = reviewOutcomes.filter(o => !o.condition || o.condition(gameState));
        const totalWeight = possibleOutcomes.reduce((sum, o) => sum + o.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenOutcome = possibleOutcomes.find(o => (cumulativeWeight += o.weight) >= rand) || possibleOutcomes[0];
        const result = chosenOutcome.effect(gameState);
        updateState(result.changes, result.message);
    },
    show_resource_gathering_options: () => updateState({ currentScenarioId: 'action_resource_gathering' }),
    show_tool_management_options: () => updateState({ currentScenarioId: 'action_tool_management' }),
    show_impromptu_crafting_options: () => updateState({ currentScenarioId: 'impromptu_crafting_menu' }),
    gather_parts: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, parts: gameState.resources.parts + gain } }, `부품을 수집했습니다. (+${gain} 부품)`);
    },
    process_materials: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(10, 4);
        updateState({ resources: { ...gameState.resources, materials: gameState.resources.materials + gain } }, `재료를 가공했습니다. (+${gain} 재료)`);
    },
    charge_energy: () => {
        if (!spendActionPoint()) return;
        const gain = getRandomValue(5, 2);
        updateState({ resources: { ...gameState.resources, energy: gameState.resources.energy + gain } }, `에너지를 충전했습니다. (+${gain} 에너지)`);
    },
    build_toolbox: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 50, energy: 20 };
        if (gameState.resources.materials >= cost.materials && gameState.resources.energy >= cost.energy) {
            gameState.tools.toolbox.built = true;
            const v = getRandomValue(10, 3);
            updateState({ skill: gameState.skill + v, resources: { ...gameState.resources, materials: gameState.resources.materials - cost.materials, energy: gameState.resources.energy - cost.energy } }, `공구함을 구매했습니다! (+${v} 기술)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_workbench: () => {
        if (!spendActionPoint()) return;
        const cost = { energy: 30, materials: 30 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.materials >= cost.materials) {
            gameState.tools.workbench.built = true;
            const v = getRandomValue(10, 3);
            updateState({ efficiency: gameState.efficiency + v, resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, materials: gameState.resources.materials - cost.materials } }, `작업대를 제작했습니다! (+${v} 효율)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_blueprintStorage: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 100, energy: 50 };
        if (gameState.resources.materials >= cost.materials && gameState.resources.energy >= cost.energy) {
            gameState.tools.blueprintStorage.built = true;
            const v = getRandomValue(15, 5);
            updateState({ logic: gameState.logic + v, resources: { ...gameState.resources, materials: gameState.resources.materials - cost.materials, energy: gameState.resources.energy - cost.energy } }, `설계도 보관소를 구축했습니다! (+${v} 논리)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_weldingMachine: () => {
        if (!spendActionPoint()) return;
        const cost = { energy: 80, materials: 40 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.materials >= cost.materials) {
            gameState.tools.weldingMachine.built = true;
            const v = getRandomValue(15, 5);
            updateState({ skill: gameState.skill + v, resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, materials: gameState.resources.materials - cost.materials } }, `용접기를 구매했습니다! (+${v} 기술)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    build_cncMachine: () => {
        if (!spendActionPoint()) return;
        const cost = { energy: 150, rare_parts: 5 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.rare_parts >= cost.rare_parts) {
            gameState.tools.cncMachine.built = true;
            const v = getRandomValue(20, 5);
            updateState({ adaptation: gameState.adaptation + v, resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, rare_parts: gameState.resources.rare_parts - cost.rare_parts } }, `CNC 머신을 설치했습니다! (+${v} 적응력)`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    maintain_tool: (params) => {
        if (!spendActionPoint()) return;
        const toolKey = params.tool;
        const cost = { energy: 10, materials: 10 };
        if (gameState.resources.energy >= cost.energy && gameState.resources.materials >= cost.materials) {
            gameState.tools[toolKey].durability = 100;
            updateState({ resources: { ...gameState.resources, energy: gameState.resources.energy - cost.energy, materials: gameState.resources.materials - cost.materials } }, `${gameState.tools[toolKey].name}을(를) 수리했습니다.`);
        } else { updateState({}, "자원이 부족합니다."); }
    },
    craft_useless_machine: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) {
            const v = getRandomValue(1, 1);
            updateState({ resources: { ...gameState.resources, rare_parts: (gameState.resources.rare_parts || 0) + v } }, `쓸모없는 기계에서 의외의 희귀 부품을 발견했습니다! (+${v} 희귀 부품)`);
        } else {
            const v = getRandomValue(10, 5);
            updateState({ logic: gameState.logic + v }, `쓸모없는 기계를 만들며 논리의 역설을 깨우쳤습니다. (+${v} 논리)`);
        }
    },
    modify_drone: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.6) {
            const v = getRandomValue(10, 5);
            updateState({ skill: gameState.skill + v }, `드론 개조에 성공하여 기술이 향상되었습니다. (+${v} 기술)`);
        } else {
            updateState({}, `드론이 폭발했습니다. 하지만 재미있었습니다.`);
        }
    },
    play_minigame: () => {
        if (!spendActionPoint()) return;
        const minigame = minigames[0];
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } });
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 다음 날로 넘어갈 수 없습니다."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
};

function applyStatEffects() {
    let message = "";
    if (gameState.logic >= 70) { message += "뛰어난 논리로 제작 성공률이 증가합니다. "; }
    if (gameState.efficiency >= 70) { const v = getRandomValue(5, 2); gameState.resources.materials += v; message += `효율적인 자원 관리로 재료를 아꼈습니다. (+${v} 재료) `; }
    if (gameState.skill >= 70) { const v = getRandomValue(2, 1); gameState.assistants.forEach(a => a.reliability = Math.min(100, a.reliability + v)); message += `당신의 뛰어난 기술에 조수들의 신뢰도가 상승합니다. (+${v} 신뢰도) `; }
    if (gameState.adaptation < 30) { gameState.actionPoints -= 1; message += "적응력이 떨어져 집중력이 1 감소합니다. "; }
    if (gameState.concentration < 30) { Object.keys(gameState.tools).forEach(key => { if(gameState.tools[key].built) gameState.tools[key].durability -= 1; }); message += "집중력 저하로 도구들이 빠르게 노후화됩니다. "; }
    return message;
}

const weightedDailyEvents = [
    { id: "material_defect", weight: 10, condition: () => gameState.efficiency < 40, onTrigger: () => { const v = getRandomValue(10, 3); updateState({ efficiency: gameState.efficiency - v, stability: gameState.stability - v }, `재료 결함이 발견되었습니다. (-${v} 효율, -${v} 안정성)`); } },
    { id: "energy_shortage", weight: 5, condition: () => true, onTrigger: () => { const v = getRandomValue(15, 5); updateState({ resources: { ...gameState.resources, energy: Math.max(0, gameState.resources.energy - v) }, concentration: gameState.concentration - 5 }, `에너지 부족으로 작업이 중단되었습니다. (-${v} 에너지, -5 집중)`); } },
    { id: "new_tool_idea", weight: 15, condition: () => true, onTrigger: () => { const v = getRandomValue(10, 5); updateState({ adaptation: gameState.adaptation + v }, `새로운 도구에 대한 아이디어가 떠올랐습니다! (+${v} 적응력)`); } },
];

function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);
    updateState({ actionPoints: 10, dailyEventTriggered: true });
    const statEffectMessage = applyStatEffects();
    let dailyMessage = "작업실에 새로운 아침이 밝았습니다. " + statEffectMessage;

    if (gameState.logic <= 0) { gameState.currentScenarioId = "game_over_logic"; }
    else if (gameState.efficiency <= 0) { gameState.currentScenarioId = "game_over_efficiency"; }
    else if (gameState.skill <= 0) { gameState.currentScenarioId = "game_over_skill"; }
    else if (gameState.resources.parts <= 0 && gameState.day > 1) { gameState.currentScenarioId = "game_over_resources"; }

    let eventId = "intro";
    const possibleEvents = weightedDailyEvents.filter(event => !event.condition || event.condition());
    if (possibleEvents.length > 0) {
        const totalWeight = possibleEvents.reduce((sum, event) => sum + event.weight, 0);
        const rand = currentRandFn() * totalWeight;
        let cumulativeWeight = 0;
        let chosenEvent = possibleEvents.find(event => (cumulativeWeight += event.weight) >= rand);
        if (chosenEvent) {
            eventId = chosenEvent.id;
            if (chosenEvent.onTrigger) chosenEvent.onTrigger();
        }
    }
    if (!gameScenarios[gameState.currentScenarioId]) {
        gameState.currentScenarioId = eventId;
    }
    updateGameDisplay(dailyMessage + (gameScenarios[gameState.currentScenarioId]?.text || ''));
    renderChoices(gameScenarios[gameState.currentScenarioId]?.choices || []);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 작업실을 폐쇄하시겠습니까? 모든 부품과 설계도가 사라집니다.")) {
        localStorage.removeItem('istpWorkshopGame');
        resetGameState();
        saveGameState();
        location.reload();
    }
}

window.onload = function() {
    try {
        initDailyGame();
        document.getElementById('resetGameBtn').addEventListener('click', resetGame);
        document.getElementById('nextDayBtn').addEventListener('click', gameActions.manualNextDay);
    } catch (e) {
        console.error("오늘의 게임 생성 중 오류 발생:", e);
        document.getElementById('gameDescription').innerText = "콘텐츠를 불러오는 데 실패했습니다. 페이지를 새로고침해 주세요.";
    }
};