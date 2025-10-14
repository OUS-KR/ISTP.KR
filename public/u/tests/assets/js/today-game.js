// today-game.js - 만능 해결사의 작업실 (The Master Craftsman's Workshop)

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

function getEulReParticle(word) {
    if (!word || word.length === 0) return "";
    const lastChar = word[word.length - 1];
    const uni = lastChar.charCodeAt(0);
    if (uni < 0xAC00 || uni > 0xD7A3) return "를";
    return (uni - 0xAC00) % 28 > 0 ? "을" : "를";
}

function getWaGwaParticle(word) {
    if (!word || word.length === 0) return "";
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
        actionPoints: 10,
        maxActionPoints: 10,
        resources: { parts: 10, materials: 10, energy: 5, rare_components: 0 },
        apprentices: [
            { id: "sparky", name: "스파키", personality: "호기심 많은", skill: "회로 분석", trust: 70 },
            { id: "gear", name: "기어", personality: "침착한", skill: "기계 조립", trust: 60 }
        ],
        maxApprentices: 5,
        currentScenarioId: "intro",
        lastPlayedDate: new Date().toISOString().slice(0, 10),
        manualDayAdvances: 0,
        dailyEventTriggered: false,
        dailyBonus: { craftSuccess: 0 },
        dailyActions: { tinkered: false, projectReviewed: false, talkedTo: [], minigamePlayed: false },
        tools: {
            toolbox: { built: false, durability: 100 },
            workbench: { built: false, durability: 100 },
            blueprintArchive: { built: false, durability: 100 },
            weldingMachine: { built: false, durability: 100 },
            cncMachine: { built: false, durability: 100 }
        },
        masteryLevel: 0,
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
        if (!loaded.apprentices || loaded.apprentices.length === 0) {
            loaded.apprentices = [
                { id: "sparky", name: "스파키", personality: "호기심 많은", skill: "회로 분석", trust: 70 },
                { id: "gear", name: "기어", personality: "침착한", skill: "기계 조립", trust: 60 }
            ];
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
    const apprenticeListHtml = gameState.apprentices.map(a => `<li>${a.name} (${a.skill}) - 신뢰도: ${a.trust}</li>`).join('');
    statsDiv.innerHTML = `
        <p><b>작업:</b> ${gameState.day}일차</p>
        <p><b>집중력:</b> ${gameState.actionPoints}/${gameState.maxActionPoints}</p>
        <p><b>논리:</b> ${gameState.logic} | <b>효율:</b> ${gameState.efficiency} | <b>기술:</b> ${gameState.skill}</p>
        <p><b>자원:</b> 부품 ${gameState.resources.parts}, 재료 ${gameState.resources.materials}, 에너지 ${gameState.resources.energy}, 희귀 부품 ${gameState.resources.rare_components || 0}</p>
        <p><b>숙련도:</b> ${gameState.masteryLevel}</p>
        <p><b>조수 (${gameState.apprentices.length}/${gameState.maxApprentices}):</b></p>
        <ul>${apprenticeListHtml}</ul>
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
    } else if (gameState.currentScenarioId === 'action_facility_management') {
        dynamicChoices = gameScenarios.action_facility_management.choices ? [...gameScenarios.action_facility_management.choices] : [];
        if (!gameState.tools.toolbox.built) dynamicChoices.push({ text: "공구함 정리 (부품 50, 재료 20)", action: "build_toolbox" });
        if (!gameState.tools.workbench.built) dynamicChoices.push({ text: "작업대 제작 (재료 30, 에너지 30)", action: "build_workbench" });
        if (!gameState.tools.blueprintArchive.built) dynamicChoices.push({ text: "설계도 보관소 구축 (부품 100, 재료 50, 에너지 50)", action: "build_blueprint_archive" });
        if (!gameState.tools.weldingMachine.built) dynamicChoices.push({ text: "용접기 도입 (재료 80, 에너지 40)", action: "build_welding_machine" });
        if (gameState.tools.workbench.built && gameState.tools.workbench.durability > 0 && !gameState.tools.cncMachine.built) {
            dynamicChoices.push({ text: "CNC 머신 설치 (재료 50, 에너지 100)", action: "build_cnc_machine" });
        }
        Object.keys(gameState.tools).forEach(key => {
            const facility = gameState.tools[key];
            if (facility.built && facility.durability < 100) {
                dynamicChoices.push({ text: `${key} 수리 (재료 10, 에너지 10)`, action: "maintain_facility", params: { facility: key } });
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

// --- Game Data ---
const gameScenarios = {
    "intro": { text: "오늘의 작업은 무엇입니까?", choices: [
        { text: "작업실 둘러보기", action: "tinker" },
        { text: "조수와 대화", action: "talk_to_apprentices" },
        { text: "프로젝트 검토", action: "review_project" },
        { text: "부품 수집", action: "show_resource_collection_options" },
        { text: "도구 관리", action: "show_facility_options" },
        { text: "오늘의 미니게임", action: "play_minigame" }
    ]},
    "daily_event_technical_difficulty": {
        text: "새로운 프로젝트에서 예상치 못한 기술적 난제에 부딪혔습니다.",
        choices: [
            { text: "밤을 새워 문제를 분석한다.", action: "handle_difficulty", params: { choice: "analyze" } },
            { text: "기존의 방식을 버리고 새로운 접근법을 시도한다.", action: "handle_difficulty", params: { choice: "improvise" } },
            { text: "잠시 머리를 식힌다.", action: "ignore_event" }
        ]
    },
    "daily_event_material_defect": { text: "공급받은 재료에 결함이 발견되었습니다. (-10 재료)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_energy_shortage": { text: "작업실의 에너지가 부족하여 일부 장비가 멈췄습니다. (-10 에너지)", choices: [{ text: "확인", action: "return_to_intro" }] },
    "daily_event_rare_part_offer": {
        text: "한 상인이 희귀한 부품을 거래하자고 제안합니다. [에너지 50]을 사용하여 [희귀 부품]을 얻을 수 있습니다.",
        choices: [
            { text: "거래한다", action: "accept_trade" },
            { text: "필요 없다", action: "decline_trade" }
        ]
    },
    "daily_event_new_apprentice": {
        choices: [
            { text: "그의 손재주를 보고 즉시 받아들인다.", action: "welcome_new_unique_apprentice" },
            { text: "작업 스타일이 맞는지 지켜본다.", action: "observe_apprentice" },
            { text: "혼자가 편하다. 거절한다.", action: "reject_apprentice" }
        ]
    },
    "game_over_logic": { text: "논리적 오류로 인해 시스템이 붕괴되었습니다.", choices: [], final: true },
    "game_over_efficiency": { text: "효율이 최악입니다. 작업실은 더 이상 돌아가지 않습니다.", choices: [], final: true },
    "game_over_skill": { text: "기술을 모두 잃었습니다. 당신은 더 이상 만능 해결사가 아닙니다.", choices: [], final: true },
    "game_over_resources": { text: "모든 부품과 재료가 소진되었습니다.", choices: [], final: true },
    "action_resource_collection": {
        text: "어떤 부품을 수집하시겠습니까?",
        choices: [
            { text: "고장난 기계 분해 (부품)", action: "perform_gather_parts" },
            { text: "재료 탐색 (재료)", action: "perform_find_materials" },
            { text: "에너지 충전 (에너지)", "action": "perform_charge_energy" },
            { text: "취소", "action": "return_to_intro" }
        ]
    },
    "action_facility_management": {
        text: "어떤 도구를 관리하시겠습니까?",
        choices: []
    },
    "resource_collection_result": {
        text: "",
        choices: [{ text: "확인", action: "show_resource_collection_options" }]
    },
    "facility_management_result": {
        text: "",
        choices: [{ text: "확인", action: "show_facility_options" }]
    },
    "difficulty_resolution_result": {
        text: "",
        choices: [{ text: "확인", action: "return_to_intro" }]
    }
};

function calculateMinigameReward(minigameName, score) {
    let rewards = { logic: 0, efficiency: 0, skill: 0, message: "" };

    switch (minigameName) {
        case "기억력 순서 맞추기":
            if (score >= 51) {
                rewards.logic = 15;
                rewards.efficiency = 10;
                rewards.skill = 5;
                rewards.message = `완벽한 기억력입니다! 모든 회로도를 기억했습니다. (+15 논리, +10 효율, +5 기술)`;
            } else if (score >= 21) {
                rewards.logic = 10;
                rewards.efficiency = 5;
                rewards.message = `훌륭한 기억력입니다. (+10 논리, +5 효율)`;
            } else if (score >= 0) {
                rewards.logic = 5;
                rewards.message = `훈련을 완료했습니다. (+5 논리)`;
            } else {
                rewards.message = `훈련을 완료했지만, 아쉽게도 보상은 없습니다.`;
            }
            break;
        case "회로 연결하기":
            rewards.logic = 10;
            rewards.message = `완벽한 회로입니다! (+10 논리)`;
            break;
        case "엔진 수리":
            rewards.skill = 10;
            rewards.message = `엔진을 완벽하게 수리했습니다. (+10 기술)`;
            break;
        case "잠금 해제":
            rewards.efficiency = 10;
            rewards.message = `최단 시간 안에 잠금을 해제했습니다. (+10 효율)`;
            break;
        case "폭탄 해체":
            rewards.logic = 5;
            rewards.skill = 5;
            rewards.message = `침착하게 폭탄을 해체했습니다. (+5 논리, +5 기술)`;
            break;
        default:
            rewards.message = `미니게임 ${minigameName}을(를) 완료했습니다.`;
            break;
    }
    return rewards;
}

const minigames = [
    {
        name: "기억력 순서 맞추기",
        description: "화면에 나타나는 회로도 순서를 기억하고 정확하게 입력하세요. 단계가 올라갈수록 어려워집니다!",
        start: (gameArea, choicesDiv) => {
            gameState.minigameState = { currentSequence: [], playerInput: [], stage: 1, score: 0, showingSequence: false };
            minigames[0].render(gameArea, choicesDiv);
            minigames[0].showSequence();
        },
        render: (gameArea, choicesDiv) => {
            gameArea.innerHTML = `
                <p><b>단계:</b> ${gameState.minigameState.stage} | <b>점수:</b> ${gameState.minigameState.score}</p>
                <p id="sequenceDisplay" style="font-size: 2em; font-weight: bold; min-height: 1.5em;"></p>
                <p>순서를 기억하고 입력하세요:</p>
                <div id="playerInputDisplay" style="font-size: 1.5em; min-height: 1.5em;">${gameState.minigameState.playerInput.join(' ')}</div>
            `;
            choicesDiv.innerHTML = `
                <div class="number-pad">
                    ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => `<button class="choice-btn num-btn" data-value="${num}">${num}</button>`).join('')}
                    <button class="choice-btn num-btn" data-value="0">0</button>
                    <button class="choice-btn submit-btn" data-action="submitSequence">입력 완료</button>
                    <button class="choice-btn reset-btn" data-action="resetInput">초기화</button>
                </div>
            `;
            choicesDiv.querySelectorAll('.num-btn').forEach(button => {
                button.addEventListener('click', () => minigames[0].processAction('addInput', button.dataset.value));
            });
            choicesDiv.querySelector('.submit-btn').addEventListener('click', () => minigames[0].processAction('submitSequence'));
            choicesDiv.querySelector('.reset-btn').addEventListener('click', () => minigames[0].processAction('resetInput'));
        },
        showSequence: () => {
            gameState.minigameState.showingSequence = true;
            gameState.minigameState.currentSequence = [];
            const sequenceLength = gameState.minigameState.stage + 2;
            for (let i = 0; i < sequenceLength; i++) {
                gameState.minigameState.currentSequence.push(Math.floor(currentRandFn() * 10));
            }

            const sequenceDisplay = document.getElementById('sequenceDisplay');
            let i = 0;
            const interval = setInterval(() => {
                if (i < gameState.minigameState.currentSequence.length) {
                    sequenceDisplay.innerText = gameState.minigameState.currentSequence[i];
                    i++;
                } else {
                    clearInterval(interval);
                    sequenceDisplay.innerText = "입력하세요!";
                    gameState.minigameState.showingSequence = false;
                }
            }, 800);
        },
        processAction: (actionType, value = null) => {
            if (gameState.minigameState.showingSequence) return;

            if (actionType === 'addInput') {
                gameState.minigameState.playerInput.push(parseInt(value));
                document.getElementById('playerInputDisplay').innerText = gameState.minigameState.playerInput.join(' ');
            } else if (actionType === 'resetInput') {
                gameState.minigameState.playerInput = [];
                document.getElementById('playerInputDisplay').innerText = '';
            } else if (actionType === 'submitSequence') {
                const correct = gameState.minigameState.currentSequence.every((num, i) => num === gameState.minigameState.playerInput[i]);

                if (correct && gameState.minigameState.playerInput.length === gameState.minigameState.currentSequence.length) {
                    gameState.minigameState.score += gameState.minigameState.currentSequence.length * 10;
                    gameState.minigameState.stage++;
                    gameState.minigameState.playerInput = [];
                    updateGameDisplay("정답입니다! 다음 단계로 넘어갑니다.");
                    minigames[0].render(document.getElementById('gameArea'), document.getElementById('gameChoices'));
                    setTimeout(() => minigames[0].showSequence(), 1500);
                } else {
                    updateGameDisplay("오답입니다. 게임 종료.");
                    minigames[0].end();
                }
            }
        },
        end: () => {
            const rewards = calculateMinigameReward(minigames[0].name, gameState.minigameState.score);
            updateState({
                logic: gameState.logic + rewards.logic,
                efficiency: gameState.efficiency + rewards.efficiency,
                skill: gameState.skill + rewards.skill,
                currentScenarioId: 'intro'
            }, rewards.message);
            gameState.minigameState = {};
        }
    },
    { name: "회로 연결하기", description: "끊어진 회로를 논리적으로 연결하여 시스템을 복구하세요.", start: (ga, cd) => { ga.innerHTML = "<p>회로 연결하기 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[1].end()'>종료</button>"; gameState.minigameState = { score: 10 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[1].name, gameState.minigameState.score); updateState({ logic: gameState.logic + r.logic, efficiency: gameState.efficiency + r.efficiency, skill: gameState.skill + r.skill, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "엔진 수리", description: "고장난 엔진의 부품을 교체하고 수리하여 다시 작동시키세요.", start: (ga, cd) => { ga.innerHTML = "<p>엔진 수리 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[2].end()'>종료</button>"; gameState.minigameState = { score: 15 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[2].name, gameState.minigameState.score); updateState({ logic: gameState.logic + r.logic, efficiency: gameState.efficiency + r.efficiency, skill: gameState.skill + r.skill, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "잠금 해제", description: "복잡한 잠금 장치를 최단 시간 안에 해제하세요.", start: (ga, cd) => { ga.innerHTML = "<p>잠금 해제 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[3].end()'>종료</button>"; gameState.minigameState = { score: 20 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[3].name, gameState.minigameState.score); updateState({ logic: gameState.logic + r.logic, efficiency: gameState.efficiency + r.efficiency, skill: gameState.skill + r.skill, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } },
    { name: "폭탄 해체", description: "제한 시간 안에 폭탄을 안전하게 해체하세요.", start: (ga, cd) => { ga.innerHTML = "<p>폭탄 해체 - 개발 중</p>"; cd.innerHTML = "<button class='choice-btn' onclick='minigames[4].end()'>종료</button>"; gameState.minigameState = { score: 25 }; }, render: () => {}, processAction: () => {}, end: () => { const r = calculateMinigameReward(minigames[4].name, gameState.minigameState.score); updateState({ logic: gameState.logic + r.logic, efficiency: gameState.efficiency + r.efficiency, skill: gameState.skill + r.skill, currentScenarioId: 'intro' }, r.message); gameState.minigameState = {}; } }
];

// --- Game Actions ---
function spendActionPoint() {
    if (gameState.actionPoints <= 0) {
        updateGameDisplay("집중력이 부족합니다.");
        return false;
    }
    updateState({ actionPoints: gameState.actionPoints - 1 });
    return true;
}

const gameActions = {
    tinker: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.tinkered) { updateState({ dailyActions: { ...gameState.dailyActions, tinkered: true } }, "오늘은 이미 충분히 작업했습니다."); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, tinkered: true } };
        let message = "작업실을 둘러보며 이것저것 만져봅니다.";
        const rand = currentRandFn();
        if (rand < 0.3) { message += " 유용한 부품을 발견했습니다. (+2 부품)"; changes.resources = { ...gameState.resources, parts: gameState.resources.parts + 2 }; }
        else if (rand < 0.6) { message += " 새로운 도구 아이디어가 떠올랐습니다. (+2 기술)"; changes.skill = gameState.skill + 2; }
        else { message += " 특별한 것은 발견하지 못했습니다."; }
        
        updateState(changes, message);
    },
    talk_to_apprentices: () => {
        if (!spendActionPoint()) return;
        const apprentice = gameState.apprentices[Math.floor(currentRandFn() * gameState.apprentices.length)];
        if (gameState.dailyActions.talkedTo.includes(apprentice.id)) { updateState({ dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, apprentice.id] } }, `${apprentice.name}${getWaGwaParticle(apprentice.name)} 이미 대화했습니다.`); return; }
        
        let changes = { dailyActions: { ...gameState.dailyActions, talkedTo: [...gameState.dailyActions.talkedTo, apprentice.id] } };
        let message = `${apprentice.name}${getWaGwaParticle(apprentice.name)} 대화했습니다. `;
        if (apprentice.trust > 80) { message += "그는 당신의 기술에 감탄하며 새로운 아이디어를 제안합니다. (+5 효율)"; changes.efficiency = gameState.efficiency + 5; }
        else if (apprentice.trust < 40) { message += "그는 당신의 작업 방식에 의문을 제기합니다. (-5 논리)"; changes.logic = gameState.logic - 5; }
        else { message += "그와의 대화를 통해 작업 효율이 올랐습니다. (+2 효율)"; changes.efficiency = gameState.efficiency + 2; }
        
        updateState(changes, message);
    },
    review_project: () => {
        if (!spendActionPoint()) return;
        if (gameState.dailyActions.projectReviewed) {
            const message = "오늘은 이미 프로젝트를 검토했습니다. (-5 효율)";
            gameState.efficiency -= 5;
            updateState({ efficiency: gameState.efficiency }, message);
            return;
        }
        updateState({ dailyActions: { ...gameState.dailyActions, projectReviewed: true } });
        const rand = currentRandFn();
        let message = "프로젝트를 검토했습니다. ";
        if (rand < 0.5) { message += "설계의 논리적 결함을 발견하여 수정했습니다. (+10 논리, +5 효율)"; updateState({ logic: gameState.logic + 10, efficiency: gameState.efficiency + 5 }); }
        else { message += "프로젝트의 기술적 완성도가 향상되었습니다. (+5 기술)"; updateState({ skill: gameState.skill + 5 }); }
        updateGameDisplay(message);
    },
    manualNextDay: () => {
        if (gameState.manualDayAdvances >= 5) { updateGameDisplay("오늘은 더 이상 수동으로 날짜를 넘길 수 없습니다. 내일 다시 시도해주세요."); return; }
        updateState({
            manualDayAdvances: gameState.manualDayAdvances + 1,
            day: gameState.day + 1,
            lastPlayedDate: new Date().toISOString().slice(0, 10),
            dailyEventTriggered: false
        });
        processDailyEvents();
    },
    handle_difficulty: (params) => {
        if (!spendActionPoint()) return;
        const { choice } = params;
        let message = "";
        let reward = { logic: 0, efficiency: 0, skill: 0 };
        
        if (choice === "analyze") {
            message = "문제를 철저히 분석하여 해결의 실마리를 찾았습니다. (+5 논리, +5 기술)";
            reward.logic += 5;
            reward.skill += 5;
        } else {
            message = "새로운 접근법이 성공했습니다! (+5 효율, +5 기술)";
            reward.efficiency += 5;
            reward.skill += 5;
        }
        
        updateState({ ...reward, currentScenarioId: 'difficulty_resolution_result' }, message);
    },
    ignore_event: () => {
        if (!spendActionPoint()) return;
        const message = "문제를 외면했습니다. 작업 효율이 떨어집니다. (-10 효율, -5 기술)";
        updateState({ efficiency: gameState.efficiency - 10, skill: gameState.skill - 5, currentScenarioId: 'difficulty_resolution_result' }, message);
    },
    show_resource_collection_options: () => updateState({ currentScenarioId: 'action_resource_collection' }),
    show_facility_options: () => updateState({ currentScenarioId: 'action_facility_management' }),
    perform_gather_parts: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.masteryLevel * 0.1) + (gameState.dailyBonus.craftSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "유용한 부품을 수집했습니다! (+5 부품)";
            changes.resources = { ...gameState.resources, parts: gameState.resources.parts + 5 };
        } else {
            message = "부품 수집에 실패했습니다.";
        }
        updateState(changes, message);
    },
    perform_find_materials: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.masteryLevel * 0.1) + (gameState.dailyBonus.craftSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "필요한 재료를 찾았습니다! (+5 재료)";
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials + 5 };
        } else {
            message = "재료를 찾지 못했습니다.";
        }
        updateState(changes, message);
    },
    perform_charge_energy: () => {
        if (!spendActionPoint()) return;
        const successChance = Math.min(0.95, 0.6 + (gameState.masteryLevel * 0.1) + (gameState.dailyBonus.craftSuccess || 0));
        let message = "";
        let changes = {};
        if (currentRandFn() < successChance) {
            message = "에너지를 충전했습니다! (+5 에너지)";
            changes.resources = { ...gameState.resources, energy: gameState.resources.energy + 5 };
        } else {
            message = "충전에 실패했습니다.";
        }
        updateState(changes, message);
    },
    build_toolbox: () => {
        if (!spendActionPoint()) return;
        const cost = { parts: 50, materials: 20 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.parts >= cost.parts) {
            gameState.tools.toolbox.built = true;
            message = "공구함을 정리했습니다!";
            changes.skill = gameState.skill + 10;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, parts: gameState.resources.parts - cost.parts };
        } else {
            message = "재료가 부족하여 정리할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_workbench: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 30, energy: 30 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.energy >= cost.energy) {
            gameState.tools.workbench.built = true;
            message = "작업대를 제작했습니다!";
            changes.efficiency = gameState.efficiency + 10;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, energy: gameState.resources.energy - cost.energy };
        } else {
            message = "재료가 부족하여 제작할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_blueprint_archive: () => {
        if (!spendActionPoint()) return;
        const cost = { parts: 100, materials: 50, energy: 50 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.energy >= cost.energy && gameState.resources.parts >= cost.parts) {
            gameState.tools.blueprintArchive.built = true;
            message = "설계도 보관소를 구축했습니다!";
            changes.skill = gameState.skill + 20;
            changes.efficiency = gameState.efficiency + 20;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, energy: gameState.resources.energy - cost.energy, parts: gameState.resources.parts - cost.parts };
        } else {
            message = "재료가 부족하여 구축할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_welding_machine: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 80, energy: 40 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.energy >= cost.energy) {
            gameState.tools.weldingMachine.built = true;
            message = "용접기를 도입했습니다!";
            changes.logic = gameState.logic + 15;
            changes.skill = gameState.skill + 10;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, energy: gameState.resources.energy - cost.energy };
        } else {
            message = "재료가 부족하여 도입할 수 없습니다.";
        }
        updateState(changes, message);
    },
    build_cnc_machine: () => {
        if (!spendActionPoint()) return;
        const cost = { materials: 50, energy: 100 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.energy >= cost.energy) {
            gameState.tools.cncMachine.built = true;
            message = "CNC 머신을 설치했습니다!";
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, energy: gameState.resources.energy - cost.energy };
        } else {
            message = "재료가 부족하여 설치할 수 없습니다.";
        }
        updateState(changes, message);
    },
    maintain_facility: (params) => {
        if (!spendActionPoint()) return;
        const facilityKey = params.facility;
        const cost = { materials: 10, energy: 10 };
        let message = "";
        let changes = {};
        if (gameState.resources.materials >= cost.materials && gameState.resources.energy >= cost.energy) {
            gameState.tools[facilityKey].durability = 100;
            message = `${facilityKey} 도구의 수리를 완료했습니다. 내구도가 100으로 회복되었습니다.`;
            changes.resources = { ...gameState.resources, materials: gameState.resources.materials - cost.materials, energy: gameState.resources.energy - cost.energy };
        } else {
            message = "수리에 필요한 재료가 부족합니다.";
        }
        updateState(changes, message);
    },
    upgrade_mastery: () => {
        if (!spendActionPoint()) return;
        const cost = 20 * (gameState.masteryLevel + 1);
        if (gameState.resources.materials >= cost && gameState.resources.energy >= cost) {
            gameState.masteryLevel++;
            updateState({ resources: { ...gameState.resources, materials: gameState.resources.materials - cost, energy: gameState.resources.energy - cost }, masteryLevel: gameState.masteryLevel });
            updateGameDisplay(`숙련도를 업그레이드했습니다! 모든 제작 성공률이 10% 증가합니다. (현재 레벨: ${gameState.masteryLevel})`);
        } else { updateGameDisplay(`업그레이드에 필요한 재료가 부족합니다. (재료 ${cost}, 에너지 ${cost} 필요)`); }
        updateState({ currentScenarioId: 'intro' });
    },
    review_blueprints: () => {
        if (!spendActionPoint()) return;
        const rand = currentRandFn();
        if (rand < 0.3) { updateState({ resources: { ...gameState.resources, materials: gameState.resources.materials + 20, energy: gameState.resources.energy + 20 } }); updateGameDisplay("과거 설계도에서 남은 자재를 발견했습니다! (+20 재료, +20 에너지)"); }
        else if (rand < 0.5) { updateState({ logic: gameState.logic + 10, skill: gameState.skill + 10 }); updateGameDisplay("과거 설계도에서 새로운 기술적 통찰을 얻었습니다. (+10 논리, +10 기술)"); }
        else { updateGameDisplay("설계도를 검토했지만, 특별한 것은 발견하지 못했습니다."); }
        updateState({ currentScenarioId: 'intro' });
    },
    accept_trade: () => {
        if (!spendActionPoint()) return;
        if (gameState.resources.energy >= 50) {
            updateState({ resources: { ...gameState.resources, energy: gameState.resources.energy - 50, rare_components: (gameState.resources.rare_components || 0) + 1 } });
            updateGameDisplay("거래에 성공하여 희귀 부품을 얻었습니다! 작업실의 기술력이 향상됩니다.");
        } else { updateGameDisplay("거래에 필요한 에너지가 부족합니다.");
        }
        updateState({ currentScenarioId: 'intro' });
    },
    decline_trade: () => {
        if (!spendActionPoint()) return;
        updateGameDisplay("거래를 거절했습니다. 다음 기회를 노려봐야겠습니다.");
        updateState({ currentScenarioId: 'intro' });
    },
    return_to_intro: () => updateState({ currentScenarioId: 'intro' }),
    play_minigame: () => {
        if (gameState.dailyActions.minigamePlayed) { updateGameDisplay("오늘의 미니게임은 이미 플레이했습니다."); return; }
        if (!spendActionPoint()) return;
        
        const minigameIndex = (gameState.day - 1) % minigames.length;
        const minigame = minigames[minigameIndex];
        
        gameState.currentScenarioId = `minigame_${minigame.name}`;
        
        updateState({ dailyActions: { ...gameState.dailyActions, minigamePlayed: true } }); 
        
        updateGameDisplay(minigame.description);
        minigame.start(document.getElementById('gameArea'), document.getElementById('gameChoices'));
    }
};

function applyStatEffects() {
    let message = "";
    if (gameState.logic >= 70) {
        gameState.dailyBonus.craftSuccess += 0.1;
        message += "뛰어난 논리력 덕분에 제작 성공률이 증가합니다. ";
    }
    if (gameState.logic < 30) {
        gameState.apprentices.forEach(a => a.trust = Math.max(0, a.trust - 5));
        message += "논리적이지 못한 판단으로 조수들의 신뢰도가 하락합니다. ";
    }

    if (gameState.efficiency >= 70) {
        gameState.maxActionPoints += 1;
        gameState.actionPoints = gameState.maxActionPoints;
        message += "높은 효율성 덕분에 하루에 더 많은 작업을 할 수 있습니다. ";
    }
    if (gameState.efficiency < 30) {
        gameState.maxActionPoints = Math.max(5, gameState.maxActionPoints - 1);
        gameState.actionPoints = Math.min(gameState.actionPoints, gameState.maxActionPoints);
        message += "효율이 낮아져 작업에 차질이 생깁니다. ";
    }

    if (gameState.skill >= 70) {
        Object.keys(gameState.tools).forEach(key => {
            if (gameState.tools[key].built) gameState.tools[key].durability = Math.min(100, gameState.tools[key].durability + 1);
        });
        message += "뛰어난 기술력 덕분에 도구 관리가 더 잘 이루어집니다. ";
    }
    if (gameState.skill < 30) {
        Object.keys(gameState.tools).forEach(key => {
            if (gameState.tools[key].built) gameState.tools[key].durability = Math.max(0, gameState.tools[key].durability - 2);
        });
        message += "기술이 부족하여 도구들이 빠르게 노후화됩니다. ";
    }
    return message;
}

function generateRandomApprentice() {
    const names = ["볼트", "너트", "렌치", "스크류"];
    const personalities = ["분석적인", "즉흥적인", "대담한", "조용한"];
    const skills = ["회로 분석", "기계 조립", "용접", "프로그래밍"];
    const randomId = Math.random().toString(36).substring(2, 9);

    return {
        id: randomId,
        name: names[Math.floor(currentRandFn() * names.length)],
        personality: personalities[Math.floor(currentRandFn() * personalities.length)],
        skill: skills[Math.floor(currentRandFn() * skills.length)],
        trust: 50
    };
}

// --- Daily/Initialization Logic ---
function processDailyEvents() {
    if (gameState.dailyEventTriggered) return;
    currentRandFn = mulberry32(getDailySeed() + gameState.day);

    updateState({
        actionPoints: 10,
        maxActionPoints: 10,
        dailyActions: { tinkered: false, projectReviewed: false, talkedTo: [], minigamePlayed: false },
        dailyEventTriggered: true,
        dailyBonus: { craftSuccess: 0 }
    });

    const statEffectMessage = applyStatEffects();

    let skillBonusMessage = "";
    let durabilityMessage = "";

    gameState.apprentices.forEach(a => {
        if (a.skill === '회로 분석') { gameState.resources.parts++; skillBonusMessage += `${a.name}의 도움으로 부품을 추가로 얻었습니다. `; }
        else if (a.skill === '기계 조립') { gameState.resources.materials++; skillBonusMessage += `${a.name}의 도움으로 재료를 추가로 얻었습니다. `; }
        else if (a.skill === '프로그래밍') { gameState.efficiency++; skillBonusMessage += `${a.name} 덕분에 작업실의 효율이 +1 향상되었습니다. `; }
    });

    Object.keys(gameState.tools).forEach(key => {
        const facility = gameState.tools[key];
        if(facility.built) {
            facility.durability -= 1;
            if(facility.durability <= 0) {
                facility.built = false;
                durabilityMessage += `${key} 도구가 파손되었습니다! 수리가 필요합니다. `; 
            }
        }
    });

    gameState.resources.parts -= gameState.apprentices.length * 2;
    let dailyMessage = "새로운 작업일이 시작되었습니다. ";
    dailyMessage += statEffectMessage + skillBonusMessage + durabilityMessage;
    if (gameState.resources.parts < 0) {
        gameState.efficiency -= 10;
        dailyMessage += "부품이 부족하여 작업 효율이 떨어집니다! (-10 효율)";
    }
    
    const rand = currentRandFn();
    let eventId = "intro";
    if (rand < 0.15) { eventId = "daily_event_material_defect"; updateState({resources: {...gameState.resources, materials: Math.max(0, gameState.resources.materials - 10)}}); }
    else if (rand < 0.30) { eventId = "daily_event_energy_shortage"; updateState({resources: {...gameState.resources, energy: Math.max(0, gameState.resources.energy - 10)}}); }
    else if (rand < 0.5 && gameState.apprentices.length >= 2) { eventId = "daily_event_technical_difficulty"; }
    else if (rand < 0.7 && gameState.tools.blueprintArchive.built && gameState.apprentices.length < gameState.maxApprentices) {
        eventId = "daily_event_new_apprentice";
        const newApprentice = generateRandomApprentice();
        gameState.pendingNewApprentice = newApprentice;
        gameScenarios["daily_event_new_apprentice"].text = `새로운 조수 ${newApprentice.name}(${newApprentice.personality}, ${newApprentice.skill})이(가) 합류하고 싶어 합니다. (현재 조수: ${gameState.apprentices.length} / ${gameState.maxApprentices})`;
    }
    else if (rand < 0.85 && gameState.tools.blueprintArchive.built) { eventId = "daily_event_rare_part_offer"; }
    
    gameState.currentScenarioId = eventId;
    updateGameDisplay(dailyMessage + (gameScenarios[eventId]?.text || ''));
    renderChoices(gameScenarios[eventId].choices);
    saveGameState();
}

function initDailyGame() {
    loadGameState();
}

function resetGame() {
    if (confirm("정말로 작업실을 초기화하시겠습니까? 모든 작업 기록이 사라집니다.")) {
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
