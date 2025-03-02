// ==UserScript==
// @name         题目解析工具 (Enhanced UI)
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  解析题目并提供导出功能 - 增强UI与动画效果
// @author       Your Name
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// ==/UserScript==

(function() {
    'use strict';

    // ===== 工具常量 =====
    const TOOL_ID = 'QAnalysis'; // 工具唯一ID
    const BOX_ID = TOOL_ID + '_box'; // 工具箱ID
    const FLOAT_BTN_ID = TOOL_ID + '_float_btn'; // 悬浮按钮ID
    const PROGRESS_CONTAINER_ID = TOOL_ID + '_progress_container'; // 进度条容器ID
    const PROGRESS_BAR_ID = TOOL_ID + '_progress_bar'; // 进度条ID
    const AI_TOOL_ID = TOOL_ID + '_ai'; // AI工具ID
    const AI_ANSWER_ID = AI_TOOL_ID + '_answer'; // AI答案容器ID

    // ===== 全局变量 =====
    let toolInitialized = false; // 工具初始化状态
    let allQsObject = []; // 所有问题对象
    let allStr = ""; // 所有问题文本
    let isProcessing = false; // 处理状态
    let selectedQuestions = new Set(); // 已选中的问题ID集合
    let lastSelectedQuestionId = null; // 上次选中的问题ID（用于Shift多选）
    let activeQuestions = {}; // 活动问题（用于AI解答）
    let isAnswering = false; // AI解答状态

    // 用户设置
    let hideMyAnswers = false; // 是否隐藏我的答案
    let includeTimestamp = true; // 是否包含时间戳
    let showExplanation = true; // 是否显示题目解析
    let darkMode = false; // 暗色模式
    let customTitle = ""; // 自定义标题
    let animationsEnabled = true; // 是否启用动画效果

    // AI设置
    let aiSettings = {
        apiType: 'openai', // API类型: openai, deepseek, gemini, anthropic
        apiKey: '', // API密钥
        temperature: 0.7, // 温度参数
        defaultPrompt: '你是一位专业的题目解析助手，请根据以下题目给出详细的解答和分析。', // 默认提示词
        customPrompts: {
            math: '你是一位数学专家，请分析以下数学题目，给出详细的解题步骤和思路。',
            english: '你是一位优秀的英语教师，请分析以下英语题目，解释相关语法、词汇知识点和答案依据。',
            science: '你是一位理科专家，请分析以下科学题目，给出详细的解答并解释相关科学原理。'
        },
        showInToolbox: true // 是否在工具箱显示AI设置
    };

    // ===== 设置管理 =====
    // 加载设置
    function loadSettings() {
        try {
            const savedSettings = localStorage.getItem(TOOL_ID + '_settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);

                // 加载基本设置
                hideMyAnswers = settings.hideMyAnswers !== undefined ? settings.hideMyAnswers : hideMyAnswers;
                includeTimestamp = settings.includeTimestamp !== undefined ? settings.includeTimestamp : includeTimestamp;
                showExplanation = settings.showExplanation !== undefined ? settings.showExplanation : showExplanation;
                darkMode = settings.darkMode !== undefined ? settings.darkMode : darkMode;
                customTitle = settings.customTitle !== undefined ? settings.customTitle : customTitle;
                animationsEnabled = settings.animationsEnabled !== undefined ? settings.animationsEnabled : animationsEnabled;

                // 加载AI设置
                if (settings.aiSettings) {
                    aiSettings = {...aiSettings, ...settings.aiSettings};

                    // 确保customPrompts对象存在
                    if (!aiSettings.customPrompts) {
                        aiSettings.customPrompts = {
                            math: '你是一位数学专家，请分析以下数学题目，给出详细的解题步骤和思路。',
                            english: '你是一位优秀的英语教师，请分析以下英语题目，解释相关语法、词汇知识点和答案依据。',
                            science: '你是一位理科专家，请分析以下科学题目，给出详细的解答并解释相关科学原理。'
                        };
                    }
                }
            }
        } catch (e) {
            console.error("加载设置失败:", e);
        }
    }

    // 保存设置
    function saveSettings() {
        try {
            const settings = {
                hideMyAnswers,
                includeTimestamp,
                showExplanation,
                darkMode,
                customTitle,
                animationsEnabled,
                aiSettings
            };
            localStorage.setItem(TOOL_ID + '_settings', JSON.stringify(settings));
        } catch (e) {
            console.error("保存设置失败:", e);
        }
    }

    // ===== 样式和界面 =====
    // 插入CSS样式
    function insertStyle() {
        const style = document.createElement('style');
        style.textContent = `
            /* 基础动画定义 */
            @keyframes ${TOOL_ID}_fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes ${TOOL_ID}_fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }

            @keyframes ${TOOL_ID}_slideInRight {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            @keyframes ${TOOL_ID}_slideOutRight {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100px); opacity: 0; }
            }

            @keyframes ${TOOL_ID}_slideInUp {
                from { transform: translateY(30px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            @keyframes ${TOOL_ID}_pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }

            @keyframes ${TOOL_ID}_shimmer {
                0% { background-position: -1000px 0; }
                100% { background-position: 1000px 0; }
            }

            @keyframes ${TOOL_ID}_rotateIn {
                from { transform: rotate(-10deg) scale(0.8); opacity: 0; }
                to { transform: rotate(0) scale(1); opacity: 1; }
            }

            @keyframes ${TOOL_ID}_shake {
                0%, 100% { transform: translateX(0); }
                10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
                20%, 40%, 60%, 80% { transform: translateX(5px); }
            }

            @keyframes ${TOOL_ID}_gradientBg {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            @keyframes ${TOOL_ID}_spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes ${TOOL_ID}_expandWidth {
                from { width: 0; }
                to { width: 100%; }
            }

            @keyframes ${TOOL_ID}_cardFlip {
                0% { transform: perspective(1000px) rotateY(0deg); }
                100% { transform: perspective(1000px) rotateY(180deg); }
            }

            @keyframes ${TOOL_ID}_highlight {
                0% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0.6); }
                70% { box-shadow: 0 0 0 10px rgba(66, 133, 244, 0); }
                100% { box-shadow: 0 0 0 0 rgba(66, 133, 244, 0); }
            }

            /* 工具箱样式 */
            #${BOX_ID} {
                position: fixed;
                top: 50px;
                right: 20px;
                width: 380px;
                height: 650px;
                background-color: #ffffff;
                box-shadow: 0 10px 30px rgba(0,0,0,0.15);
                border-radius: 12px;
                z-index: 9999;
                display: none;
                overflow: hidden;
                font-family: 'Microsoft YaHei', Arial, sans-serif;
                font-size: 14px;
                color: #333;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                backdrop-filter: blur(8px);
                border: 1px solid rgba(255,255,255,0.1);
            }

            .${TOOL_ID}_animations_enabled #${BOX_ID}.visible {
                animation: ${TOOL_ID}_rotateIn 0.5s forwards;
            }

            #${BOX_ID}.dark-mode {
                background-color: #222;
                color: #eee;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }

            #${BOX_ID}_header {
                background: linear-gradient(135deg, #4285f4, #3270d8);
                background-size: 200% 200%;
                color: white;
                padding: 14px 18px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                user-select: none;
                border-radius: 12px 12px 0 0;
                position: relative;
                overflow: hidden;
            }

            .${TOOL_ID}_animations_enabled #${BOX_ID}_header {
                animation: ${TOOL_ID}_gradientBg 5s ease infinite;
            }

            #${BOX_ID}_header:after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%);
                background-size: 200% 100%;
                pointer-events: none;
            }

            .${TOOL_ID}_animations_enabled #${BOX_ID}_header:after {
                animation: ${TOOL_ID}_shimmer 3s infinite;
            }

            #${BOX_ID}_header_title {
                font-weight: 600;
                font-size: 16px;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
            }

            #${BOX_ID}_header_title:before {
                content: '📝';
                margin-right: 8px;
                font-size: 18px;
            }

            .${TOOL_ID}_animations_enabled #${BOX_ID}_header_title:before {
                animation: ${TOOL_ID}_pulse 2s infinite;
                display: inline-block;
            }

            #${BOX_ID}_close_btn {
                background: rgba(255,255,255,0.1);
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                opacity: 0.9;
                transition: all 0.2s;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #${BOX_ID}_close_btn:hover {
                background-color: rgba(255,255,255,0.25);
                opacity: 1;
                transform: rotate(90deg);
            }

            #${BOX_ID}_content {
                padding: 20px;
                height: calc(100% - 60px);
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: #ccc transparent;
                position: relative;
            }

            #${BOX_ID}.dark-mode #${BOX_ID}_content {
                scrollbar-color: #555 #222;
            }

            #${BOX_ID}_content::-webkit-scrollbar {
                width: 6px;
            }

            #${BOX_ID}_content::-webkit-scrollbar-track {
                background: transparent;
                border-radius: 10px;
            }

            #${BOX_ID}_content::-webkit-scrollbar-thumb {
                background-color: #ccc;
                border-radius: 10px;
            }

            #${BOX_ID}.dark-mode #${BOX_ID}_content::-webkit-scrollbar-thumb {
                background-color: #555;
            }

            #${BOX_ID}_content::-webkit-scrollbar-thumb:hover {
                background-color: #aaa;
            }

            #${BOX_ID}.dark-mode #${BOX_ID}_content::-webkit-scrollbar-thumb:hover {
                background-color: #777;
            }

            #${BOX_ID}_title {
                margin-top: 0;
                margin-bottom: 20px;
                font-size: 18px;
                font-weight: bold;
                color: #333;
                text-align: center;
                position: relative;
                padding-bottom: 10px;
            }

            #${BOX_ID}_title:after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                width: 50px;
                height: 3px;
                background: linear-gradient(90deg, #4285f4, #34a853);
                border-radius: 3px;
            }

            .${TOOL_ID}_animations_enabled #${BOX_ID}_title:after {
                animation: ${TOOL_ID}_expandWidth 2s ease-out;
                width: 80px;
            }

            #${BOX_ID}.dark-mode #${BOX_ID}_title {
                color: #eee;
            }

            /* 选项卡样式 */
            .${TOOL_ID}_tabs {
                display: flex;
                background-color: #f8f9fa;
                border-radius: 10px;
                padding: 3px;
                margin-bottom: 20px;
                position: relative;
                overflow: hidden;
                border: 1px solid #eee;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_tabs {
                background-color: #333;
                border-color: #444;
            }

            .${TOOL_ID}_tab {
                flex: 1;
                padding: 10px 15px;
                background: none;
                border: none;
                cursor: pointer;
                font-size: 14px;
                color: #666;
                position: relative;
                z-index: 2;
                transition: all 0.3s;
                border-radius: 8px;
                text-align: center;
                font-weight: 500;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_tab {
                color: #aaa;
            }

            .${TOOL_ID}_tab.active {
                color: #fff;
            }

            .${TOOL_ID}_tab_slider {
                position: absolute;
                top: 3px;
                left: 3px;
                bottom: 3px;
                background: linear-gradient(135deg, #4285f4, #3270d8);
                z-index: 1;
                border-radius: 8px;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_tab:hover:not(.active) {
                transform: translateY(-2px);
            }

            .${TOOL_ID}_tab_content {
                display: none;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.3s ease;
            }

            .${TOOL_ID}_tab_content.active {
                display: block;
                opacity: 1;
                transform: translateY(0);
            }

            /* 开关样式 */
            .${TOOL_ID}_switch_container {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                padding: 10px 12px;
                border-radius: 8px;
                background-color: #f8f9fa;
                transition: all 0.2s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_switch_container:hover {
                background-color: #f1f3f5;
                transform: translateX(5px);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_switch_container {
                background-color: #333;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_switch_container:hover {
                background-color: #3a3a3a;
            }

            .${TOOL_ID}_switch {
                position: relative;
                display: inline-block;
                width: 50px;
                height: 26px;
                margin-right: 12px;
            }

            .${TOOL_ID}_switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }

            .${TOOL_ID}_slider {
                position: absolute;
                cursor: pointer;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-color: #ccc;
                transition: .4s;
                border-radius: 26px;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_slider {
                background-color: #555;
            }

            .${TOOL_ID}_slider:before {
                position: absolute;
                content: "";
                height: 18px;
                width: 18px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: .4s;
                border-radius: 50%;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            }

            .${TOOL_ID}_switch input:checked + .${TOOL_ID}_slider {
                background-color: #4285f4;
            }

            .${TOOL_ID}_switch input:focus + .${TOOL_ID}_slider {
                box-shadow: 0 0 2px #4285f4;
            }

            .${TOOL_ID}_switch input:checked + .${TOOL_ID}_slider:before {
                transform: translateX(24px);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_switch input:checked + .${TOOL_ID}_slider:before {
                animation: ${TOOL_ID}_pulse 0.3s;
            }

            .${TOOL_ID}_switch_label {
                font-size: 14px;
                color: #555;
                flex: 1;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_switch_label {
                color: #bbb;
            }

            /* 输入框样式 */
            .${TOOL_ID}_input_label {
                display: block;
                margin-bottom: 8px;
                font-size: 14px;
                color: #555;
                font-weight: 500;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_input_label {
                color: #bbb;
            }

            .${TOOL_ID}_input {
                width: 100%;
                padding: 12px 15px;
                border: 1px solid #ddd;
                border-radius: 8px;
                margin-bottom: 20px;
                font-size: 14px;
                transition: all 0.3s;
                background-color: #fff;
                color: #333;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_input {
                background-color: #333;
                border: 1px solid #555;
                color: #eee;
            }

            .${TOOL_ID}_input:focus {
                border-color: #4285f4;
                outline: none;
                box-shadow: 0 0 0 3px rgba(77, 118, 255, 0.2);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_input:focus {
                animation: ${TOOL_ID}_highlight 1.5s;
            }

            /* 按钮样式 */
            .${TOOL_ID}_btn_container {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
                margin-bottom: 20px;
            }

            .${TOOL_ID}_btn {
                background: linear-gradient(135deg, #4285f4, #3270d8);
                color: white;
                border: none;
                padding: 12px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
                flex: 1;
                min-width: 100px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                position: relative;
                overflow: hidden;
            }

            .${TOOL_ID}_btn:after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
                transform: translateX(-100%);
                transition: transform 0.5s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_btn:hover:after {
                transform: translateX(100%);
            }

            .${TOOL_ID}_btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 12px rgba(0,0,0,0.15);
            }

            .${TOOL_ID}_btn:active {
                transform: translateY(0);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .${TOOL_ID}_btn:disabled {
                background: linear-gradient(135deg, #b0bec5, #90a4ae);
                cursor: not-allowed;
                box-shadow: none;
                transform: none;
            }

            .${TOOL_ID}_btn:disabled:after {
                display: none;
            }

            .${TOOL_ID}_btn_icon {
                margin-right: 8px;
                font-size: 16px;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_btn_icon {
                display: inline-block;
                transform-origin: center;
                transition: transform 0.3s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_btn:hover .${TOOL_ID}_btn_icon {
                transform: scale(1.2) rotate(5deg);
            }

            .${TOOL_ID}_loading {
                display: inline-block;
                width: 18px;
                height: 18px;
                border: 2px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: ${TOOL_ID}_spin 1s ease-in-out infinite;
                margin-right: 10px;
            }

            /* 状态指示器样式 */
            .${TOOL_ID}_status {
                display: flex;
                align-items: center;
                padding: 15px;
                margin: 20px 0;
                background-color: #f5f7fa;
                border-radius: 8px;
                font-size: 14px;
                color: #555;
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                transition: all 0.3s;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_status {
                background-color: #333;
                color: #bbb;
                box-shadow: 0 2px 5px rgba(0,0,0,0.15);
            }

            .${TOOL_ID}_status.active {
                background-color: #e3f2fd;
                color: #1565c0;
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            .${TOOL_ID}_status.success {
                background-color: #e8f5e9;
                color: #2e7d32;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_status.success {
                animation: ${TOOL_ID}_highlight 1.5s;
            }

            .${TOOL_ID}_status.error {
                background-color: #fdecea;
                color: #d32f2f;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_status.error {
                animation: ${TOOL_ID}_shake 0.5s;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_status.active {
                background-color: #0a2742;
                color: #64b5f6;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_status.success {
                background-color: #0f2a19;
                color: #66bb6a;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_status.error {
                background-color: #3e1c1a;
                color: #ef5350;
            }

            .${TOOL_ID}_status_icon {
                margin-right: 10px;
                font-size: 18px;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_status_icon {
                display: inline-block;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_status.active .${TOOL_ID}_status_icon {
                animation: ${TOOL_ID}_spin 1.5s linear infinite;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_status.success .${TOOL_ID}_status_icon {
                animation: ${TOOL_ID}_pulse 1s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_status.error .${TOOL_ID}_status_icon {
                animation: ${TOOL_ID}_shake 0.5s;
            }

            /* 进度条样式 */
            #${PROGRESS_CONTAINER_ID} {
                margin: 20px 0;
                display: none;
            }

            #${PROGRESS_BAR_ID} {
                height: 8px;
                background-color: #e0e0e0;
                border-radius: 10px;
                overflow: hidden;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
            }

            #${BOX_ID}.dark-mode #${PROGRESS_BAR_ID} {
                background-color: #444;
            }

            #${PROGRESS_BAR_ID}_fill {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #4285f4, #34a853);
                transition: width 0.5s cubic-bezier(0.165, 0.84, 0.44, 1);
                border-radius: 10px;
                position: relative;
                overflow: hidden;
            }

            #${PROGRESS_BAR_ID}_fill:after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.3) 50%, rgba(255,255,255,0) 100%);
                background-size: 50% 100%;
                animation: ${TOOL_ID}_shimmer 1.5s infinite;
            }

            #${PROGRESS_BAR_ID}_text {
                font-size: 12px;
                color: #666;
                text-align: center;
                margin-top: 8px;
                font-weight: 500;
            }

            #${BOX_ID}.dark-mode #${PROGRESS_BAR_ID}_text {
                color: #aaa;
            }

            /* 题目列表样式 */
            #${BOX_ID}_qlist {
                margin-top: 20px;
            }

            .${TOOL_ID}_empty_state {
                text-align: center;
                padding: 60px 20px;
                color: #999;
                background-color: #f9f9f9;
                border-radius: 10px;
                margin: 20px 0;
                transition: all 0.3s;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_empty_state {
                color: #777;
                background-color: #2a2a2a;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_empty_state:hover {
                transform: scale(1.02);
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_empty_state:hover {
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            }

            .${TOOL_ID}_empty_icon {
                font-size: 48px;
                margin-bottom: 20px;
                display: inline-block;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_empty_icon {
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            .${TOOL_ID}_empty_text {
                font-size: 18px;
                margin-bottom: 10px;
                font-weight: 500;
            }

            /* 题目部分样式 */
            .${TOOL_ID}_question_section {
                margin-bottom: 25px;
                background-color: #fff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                transition: all 0.3s;
                transform-origin: center;
                opacity: 0;
                transform: translateY(20px);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_section.animated {
                animation: ${TOOL_ID}_slideInUp 0.5s forwards;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_section:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 20px rgba(0,0,0,0.12);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_section {
                background-color: #2a2a2a;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_section:hover {
                box-shadow: 0 8px 20px rgba(0,0,0,0.35);
            }

            .${TOOL_ID}_question_section_title {
                background: linear-gradient(135deg, #f5f7fa, #e4e7eb);
                padding: 15px 20px;
                font-size: 16px;
                font-weight: 600;
                color: #333;
                border-bottom: 1px solid #eee;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }

            .${TOOL_ID}_question_section_title:before {
                content: '📚';
                margin-right: 10px;
                font-size: 18px;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_section_title:before {
                display: inline-block;
                transition: all 0.3s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_section:hover .${TOOL_ID}_question_section_title:before {
                transform: scale(1.2) rotate(10deg);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_section_title {
                background: linear-gradient(135deg, #333, #2a2a2a);
                color: #eee;
                border-bottom: 1px solid #444;
            }

            .${TOOL_ID}_question_item {
                padding: 18px;
                border-bottom: 1px solid #f0f0f0;
                transition: all 0.3s;
                position: relative;
                overflow: hidden;
            }

            .${TOOL_ID}_question_item:before {
                content: '';
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                width: 3px;
                background-color: #4285f4;
                opacity: 0;
                transition: all 0.3s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_item:hover:before {
                opacity: 1;
            }

            .${TOOL_ID}_question_item:last-child {
                border-bottom: none;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_item:hover {
                background-color: #f8f9fa;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_item {
                border-bottom: 1px solid #383838;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_item:hover {
                background-color: #333;
            }

            .${TOOL_ID}_question_header {
                display: flex;
                margin-bottom: 12px;
            }

            .${TOOL_ID}_question_title {
                color: #333;
                font-weight: 500;
                line-height: 1.5;
                flex: 1;
                transition: all 0.3s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_item:hover .${TOOL_ID}_question_title {
                color: #4285f4;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_title {
                color: #eee;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_item:hover .${TOOL_ID}_question_title {
                color: #64b5f6;
            }

            .${TOOL_ID}_question_options {
                margin-left: 30px;
                margin-bottom: 15px;
                position: relative;
            }

            .${TOOL_ID}_question_options:before {
                content: '';
                position: absolute;
                left: -15px;
                top: 0;
                bottom: 0;
                width: 2px;
                background-color: #e0e0e0;
                border-radius: 2px;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_options:before {
                background-color: #444;
            }

            .${TOOL_ID}_question_option {
                margin: 8px 0;
                color: #555;
                transition: all 0.3s;
                padding: 5px 0;
                position: relative;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_question_option:hover {
                transform: translateX(5px);
                color: #333;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_option {
                color: #bbb;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_question_option:hover {
                color: #eee;
            }

            .${TOOL_ID}_my_answer {
                color: #1976d2;
                background-color: #e3f2fd;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                display: inline-block;
                transition: all 0.3s;
                margin-right: 10px;
                box-shadow: 0 2px 5px rgba(25, 118, 210, 0.1);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_my_answer:hover {
                transform: translateY(-3px);
                box-shadow: 0 5px 10px rgba(25, 118, 210, 0.2);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_my_answer {
                background-color: #0a2742;
                color: #64b5f6;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_my_answer:hover {
                box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
            }

            .${TOOL_ID}_correct_answer {
                color: #2e7d32;
                background-color: #e8f5e9;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                display: inline-block;
                transition: all 0.3s;
                box-shadow: 0 2px 5px rgba(46, 125, 50, 0.1);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_correct_answer:hover {
                transform: translateY(-3px);
                box-shadow: 0 5px 10px rgba(46, 125, 50, 0.2);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_correct_answer {
                background-color: #0f2a19;
                color: #66bb6a;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_correct_answer:hover {
                box-shadow: 0 5px 10px rgba(0, 0, 0, 0.3);
            }

            .${TOOL_ID}_mismatch_indicator {
                color: #d32f2f;
                background-color: #fdecea;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 14px;
                margin-top: 12px;
                display: inline-block;
                animation: ${TOOL_ID}_pulse 2s infinite;
                box-shadow: 0 2px 5px rgba(211, 47, 47, 0.1);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_mismatch_indicator {
                background-color: #3e1c1a;
                color: #ef5350;
                box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            }

            .${TOOL_ID}_explanation {
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px dashed #eee;
                font-size: 14px;
                color: #555;
                transition: all 0.3s;
                position: relative;
                padding-left: 15px;
            }

            .${TOOL_ID}_explanation:before {
                content: '';
                position: absolute;
                left: 0;
                top: 15px;
                bottom: 0;
                width: 3px;
                background-color: #4285f4;
                border-radius: 3px;
                opacity: 0.6;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_explanation {
                border-top: 1px dashed #444;
                color: #bbb;
            }

            .${TOOL_ID}_explanation_title {
                font-weight: 600;
                margin-bottom: 10px;
                color: #333;
                display: flex;
                align-items: center;
            }

            .${TOOL_ID}_explanation_title:before {
                content: '💡';
                margin-right: 8px;
                font-size: 16px;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_explanation_title:before {
                display: inline-block;
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_explanation_title {
                color: #eee;
            }

            /* 图片样式 */
            .${TOOL_ID}_img_container {
                margin: 15px 0;
                text-align: center;
                transition: all 0.3s;
                position: relative;
                overflow: hidden;
                border-radius: 8px;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_img_container:hover {
                transform: scale(1.02);
            }

            .${TOOL_ID}_img {
                max-width: 100%;
                max-height: 300px;
                border: 1px solid #ddd;
                padding: 5px;
                border-radius: 8px;
                background-color: #fff;
                box-shadow: 0 3px 10px rgba(0,0,0,0.08);
                transition: all 0.3s;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_img:hover {
                box-shadow: 0 8px 20px rgba(0,0,0,0.15);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_img {
                border: 1px solid #444;
                background-color: #333;
                box-shadow: 0 3px 10px rgba(0,0,0,0.25);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_img:hover {
                box-shadow: 0 8px 20px rgba(0,0,0,0.4);
            }

            .${TOOL_ID}_img_caption {
                font-size: 12px;
                color: #666;
                margin-top: 8px;
                padding: 5px 10px;
                background-color: rgba(0,0,0,0.03);
                border-radius: 20px;
                display: inline-block;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_img_caption {
                color: #aaa;
                background-color: rgba(255,255,255,0.05);
            }

            /* 浮动按钮样式 */
            #${FLOAT_BTN_ID} {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4285f4, #3270d8);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                z-index: 9998;
                font-size: 28px;
                border: none;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                overflow: hidden;
            }

            #${FLOAT_BTN_ID}:after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%);
                opacity: 0;
                transition: all 0.5s;
            }

            .${TOOL_ID}_animations_enabled #${FLOAT_BTN_ID}:hover {
                transform: translateY(-5px) rotate(10deg);
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            }

            .${TOOL_ID}_animations_enabled #${FLOAT_BTN_ID}:hover:after {
                opacity: 1;
            }

            #${FLOAT_BTN_ID}:active {
                transform: translateY(0) scale(0.95);
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }

            .${TOOL_ID}_animations_enabled #${FLOAT_BTN_ID} {
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            /* 题目选择相关样式 */
            .${TOOL_ID}_question_checkbox {
                flex-shrink: 0;
                margin-right: 12px;
                margin-top: 3px;
            }

            .${TOOL_ID}_checkbox_container {
                display: block;
                position: relative;
                width: 22px;
                height: 22px;
                cursor: pointer;
            }

            .${TOOL_ID}_checkbox_container input {
                position: absolute;
                opacity: 0;
                cursor: pointer;
                height: 0;
                width: 0;
            }

            .${TOOL_ID}_checkbox_checkmark {
                position: absolute;
                top: 0;
                left: 0;
                height: 22px;
                width: 22px;
                background-color: #eee;
                border-radius: 6px;
                transition: all 0.3s;
                box-shadow: inset 0 1px 3px rgba(0,0,0,0.1);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_checkbox_checkmark {
                background-color: #444;
            }

            .${TOOL_ID}_checkbox_container:hover .${TOOL_ID}_checkbox_checkmark {
                background-color: #ddd;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_checkbox_container:hover .${TOOL_ID}_checkbox_checkmark {
                background-color: #555;
            }

            .${TOOL_ID}_checkbox_container input:checked ~ .${TOOL_ID}_checkbox_checkmark {
                background-color: #4285f4;
                box-shadow: 0 2px 5px rgba(66,133,244,0.3);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_checkbox_container input:checked ~ .${TOOL_ID}_checkbox_checkmark {
                animation: ${TOOL_ID}_pulse 0.3s;
            }

            .${TOOL_ID}_checkbox_container input:checked ~ .${TOOL_ID}_checkbox_checkmark:after {
                content: "";
                position: absolute;
                display: block;
                left: 8px;
                top: 4px;
                width: 6px;
                height: 12px;
                border: solid white;
                border-width: 0 2px 2px 0;
                transform: rotate(45deg);
            }

            /* 预览模态框样式 */
            .${TOOL_ID}_modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.7);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                opacity: 0;
                visibility: hidden;
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_modal {
                transform: scale(1.1);
            }

            .${TOOL_ID}_modal.active {
                opacity: 1;
                visibility: visible;
                transform: scale(1);
            }

            .${TOOL_ID}_modal_content {
                background-color: #fff;
                width: 85%;
                height: 90%;
                border-radius: 15px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                transform: translateY(30px);
                opacity: 0;
                transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
                transition-delay: 0.1s;
            }

            .${TOOL_ID}_modal.active .${TOOL_ID}_modal_content {
                transform: translateY(0);
                opacity: 1;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_modal_content,
            .dark-mode .${TOOL_ID}_modal_content {
                background-color: #222;
                color: #eee;
            }

            .${TOOL_ID}_modal_header {
                background: linear-gradient(135deg, #4285f4, #3270d8);
                color: white;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
                overflow: hidden;
            }

            .${TOOL_ID}_modal_header:after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%);
                transform: translateX(-100%);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_modal_header:after {
                animation: ${TOOL_ID}_shimmer 3s infinite;
            }

            .${TOOL_ID}_modal_title {
                font-size: 18px;
                font-weight: 600;
                letter-spacing: 0.5px;
                display: flex;
                align-items: center;
            }

            .${TOOL_ID}_modal_title:before {
                content: '👁️';
                margin-right: 10px;
                font-size: 20px;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_modal_title:before {
                display: inline-block;
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            .${TOOL_ID}_modal_close {
                background: rgba(255,255,255,0.1);
                border: none;
                color: white;
                font-size: 22px;
                cursor: pointer;
                opacity: 0.9;
                transition: all 0.3s;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .${TOOL_ID}_modal_close:hover {
                background-color: rgba(255,255,255,0.25);
                opacity: 1;
                transform: rotate(90deg);
            }

            .${TOOL_ID}_modal_body {
                flex: 1;
                overflow-y: auto;
                padding: 25px;
                scrollbar-width: thin;
                scrollbar-color: #ccc transparent;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_modal_body,
            .dark-mode .${TOOL_ID}_modal_body {
                scrollbar-color: #555 #222;
            }

            .${TOOL_ID}_modal_body::-webkit-scrollbar {
                width: 8px;
            }

            .${TOOL_ID}_modal_body::-webkit-scrollbar-track {
                background: transparent;
                border-radius: 10px;
            }

            .${TOOL_ID}_modal_body::-webkit-scrollbar-thumb {
                background-color: #ccc;
                border-radius: 10px;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_modal_body::-webkit-scrollbar-thumb,
            .dark-mode .${TOOL_ID}_modal_body::-webkit-scrollbar-thumb {
                background-color: #555;
            }

            .${TOOL_ID}_modal_body::-webkit-scrollbar-thumb:hover {
                background-color: #aaa;
            }

            .dark-mode .${TOOL_ID}_modal_body::-webkit-scrollbar-thumb:hover {
                background-color: #777;
            }

            .${TOOL_ID}_modal_footer {
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-top: 1px solid #eee;
                background-color: #f8f9fa;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_modal_footer,
            .dark-mode .${TOOL_ID}_modal_footer {
                border-top: 1px solid #444;
                background-color: #333;
            }

            .${TOOL_ID}_tabs {
                display: flex;
                border-bottom: 1px solid #eee;
                margin-bottom: 20px;
                position: relative;
            }

            .dark-mode .${TOOL_ID}_tabs {
                border-bottom: 1px solid #444;
            }

            .${TOOL_ID}_tab {
                padding: 12px 20px;
                background: none;
                border: none;
                border-bottom: 3px solid transparent;
                cursor: pointer;
                font-size: 15px;
                color: #666;
                transition: all 0.3s;
                position: relative;
                overflow: hidden;
                z-index: 1;
            }

            .${TOOL_ID}_tab:after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 50%;
                width: 0;
                height: 3px;
                background: linear-gradient(90deg, #4285f4, #34a853);
                transition: all 0.3s;
                transform: translateX(-50%);
                z-index: -1;
            }

            .dark-mode .${TOOL_ID}_tab {
                color: #aaa;
            }

            .${TOOL_ID}_tab.active {
                color: #4285f4;
                font-weight: 500;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_tab.active:after,
            .${TOOL_ID}_animations_enabled .${TOOL_ID}_tab:hover:after {
                width: 100%;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_tab:hover:not(.active) {
                color: #4285f4;
                background-color: rgba(0,0,0,0.02);
            }

            .dark-mode .${TOOL_ID}_tab.active {
                color: #64b5f6;
            }

            .dark-mode .${TOOL_ID}_tab:hover:not(.active) {
                background-color: #333;
                color: #64b5f6;
            }

            .${TOOL_ID}_tab_content {
                display: none;
                opacity: 0;
                transform: translateY(10px);
                transition: all 0.4s ease;
            }

            .${TOOL_ID}_tab_content.active {
                display: block;
                opacity: 1;
                transform: translateY(0);
            }

            .${TOOL_ID}_form_group {
                margin-bottom: 20px;
            }

            .${TOOL_ID}_label {
                display: block;
                margin-bottom: 8px;
                font-weight: 500;
                color: #555;
            }

            .dark-mode .${TOOL_ID}_label {
                color: #ccc;
            }

            .${TOOL_ID}_select,
            .${TOOL_ID}_textarea {
                width: 100%;
                padding: 12px 15px;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-size: 14px;
                transition: all 0.3s;
                background-color: #fff;
                color: #333;
            }

            .${TOOL_ID}_textarea {
                min-height: 100px;
                resize: vertical;
                line-height: 1.5;
            }

            .dark-mode .${TOOL_ID}_select,
            .dark-mode .${TOOL_ID}_textarea {
                background-color: #333;
                border: 1px solid #555;
                color: #eee;
            }

            .${TOOL_ID}_select:focus,
            .${TOOL_ID}_textarea:focus {
                border-color: #4285f4;
                outline: none;
                box-shadow: 0 0 0 3px rgba(77, 118, 255, 0.2);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_select:focus,
            .${TOOL_ID}_animations_enabled .${TOOL_ID}_textarea:focus {
                animation: ${TOOL_ID}_highlight 1.5s;
            }

            /* AI解答按钮样式 */
            .${AI_TOOL_ID}_btn {
                background: linear-gradient(135deg, #4d76ff, #3a5ccc);
                color: white;
                border: none;
                padding: 10px 16px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 15px 0;
                box-shadow: 0 3px 8px rgba(77, 118, 255, 0.2);
                position: relative;
                overflow: hidden;
            }

            .${AI_TOOL_ID}_btn:after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0) 100%);
                transform: translateX(-100%);
                transition: transform 0.5s;
            }

            .${TOOL_ID}_animations_enabled .${AI_TOOL_ID}_btn:hover:after {
                transform: translateX(100%);
            }

            .${AI_TOOL_ID}_btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 6px 15px rgba(77, 118, 255, 0.25);
            }

            .${AI_TOOL_ID}_btn:active {
                transform: translateY(-1px);
                box-shadow: 0 3px 8px rgba(77, 118, 255, 0.2);
            }

            .${AI_TOOL_ID}_btn:disabled {
                background: linear-gradient(135deg, #b0bec5, #90a4ae);
                cursor: not-allowed;
                box-shadow: none;
                transform: none;
            }

            .${AI_TOOL_ID}_btn:disabled:after {
                display: none;
            }

            .${AI_TOOL_ID}_config_btn {
                background-color: rgba(0,0,0,0.05);
                color: #666;
                border: 1px solid #ddd;
                padding: 6px 10px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                margin-left: 10px;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .${AI_TOOL_ID}_config_btn:hover {
                background-color: rgba(0,0,0,0.08);
                border-color: #ccc;
                transform: translateY(-2px);
            }

            .dark-mode .${AI_TOOL_ID}_config_btn {
                color: #ccc;
                border-color: #555;
                background-color: rgba(255,255,255,0.05);
            }

            .dark-mode .${AI_TOOL_ID}_config_btn:hover {
                background-color: rgba(255,255,255,0.1);
                border-color: #666;
            }

            .${AI_TOOL_ID}_loading {
                display: inline-block;
                width: 18px;
                height: 18px;
                border: 3px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: ${AI_TOOL_ID}_spin 1s ease-in-out infinite;
                margin-right: 10px;
            }

            @keyframes ${AI_TOOL_ID}_spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .${AI_TOOL_ID}_answer_container {
                margin-top: 20px;
                padding: 20px;
                background-color: #f8f9ff;
                border-radius: 10px;
                border-left: 4px solid #4d76ff;
                font-size: 14px;
                line-height: 1.6;
                position: relative;
                box-shadow: 0 3px 10px rgba(77, 118, 255, 0.1);
                transition: all 0.3s;
                transform: translateY(10px);
                opacity: 0;
                animation: ${TOOL_ID}_slideInUp 0.5s forwards;
            }

            .${TOOL_ID}_animations_enabled .${AI_TOOL_ID}_answer_container:hover {
                box-shadow: 0 6px 15px rgba(77, 118, 255, 0.15);
                transform: translateY(-3px);
            }

            .dark-mode .${AI_TOOL_ID}_answer_container {
                background-color: #2d2d3d;
                border-left: 4px solid #4d76ff;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            }

            .dark-mode .${AI_TOOL_ID}_answer_container:hover {
                box-shadow: 0 6px 15px rgba(0,0,0,0.3);
            }

            .${AI_TOOL_ID}_answer_header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 1px solid rgba(0,0,0,0.05);
                font-weight: 600;
                color: #333;
            }

            .dark-mode .${AI_TOOL_ID}_answer_header {
                border-bottom: 1px solid rgba(255,255,255,0.1);
                color: #eee;
            }

            .${AI_TOOL_ID}_answer_header:before {
                content: '🤖';
                margin-right: 8px;
                font-size: 16px;
            }

            .${TOOL_ID}_animations_enabled .${AI_TOOL_ID}_answer_header:before {
                display: inline-block;
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            .${AI_TOOL_ID}_answer_content {
                color: #333;
                white-space: pre-wrap;
                position: relative;
                padding: 0 5px;
            }

            .${AI_TOOL_ID}_answer_content:before {
                content: '';
                position: absolute;
                left: -10px;
                top: 0;
                bottom: 0;
                width: 2px;
                background-color: rgba(77, 118, 255, 0.2);
                border-radius: 2px;
            }

            .dark-mode .${AI_TOOL_ID}_answer_content {
                color: #ddd;
            }

            .dark-mode .${AI_TOOL_ID}_answer_content:before {
                background-color: rgba(77, 118, 255, 0.4);
            }

            .${AI_TOOL_ID}_answer_actions {
                display: flex;
                justify-content: flex-end;
                margin-top: 15px;
                gap: 10px;
            }

            .${AI_TOOL_ID}_action_btn {
                background-color: rgba(0,0,0,0.03);
                border: 1px solid #ddd;
                padding: 6px 12px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                align-items: center;
                transition: all 0.3s;
                color: #555;
            }

            .${AI_TOOL_ID}_action_btn:hover {
                background-color: rgba(0,0,0,0.05);
                transform: translateY(-2px);
                box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            }

            .dark-mode .${AI_TOOL_ID}_action_btn {
                border: 1px solid #555;
                color: #ddd;
                background-color: rgba(255,255,255,0.05);
            }

            .dark-mode .${AI_TOOL_ID}_action_btn:hover {
                background-color: rgba(255,255,255,0.08);
                box-shadow: 0 2px 5px rgba(0,0,0,0.15);
            }

            .${AI_TOOL_ID}_action_icon {
                margin-right: 6px;
                font-size: 14px;
                display: inline-block;
            }

            .${TOOL_ID}_animations_enabled .${AI_TOOL_ID}_action_btn:hover .${AI_TOOL_ID}_action_icon {
                animation: ${TOOL_ID}_pulse 1s;
            }

            /* AI浮动按钮样式 */
            #${AI_TOOL_ID}_float_btn {
                position: fixed;
                bottom: 20px;
                left: 20px;
                width: 55px;
                height: 55px;
                border-radius: 50%;
                background: linear-gradient(135deg, #4d76ff, #3a5ccc);
                color: white;
                border: none;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                z-index: 9999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                overflow: hidden;
            }

            #${AI_TOOL_ID}_float_btn:after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0) 70%);
                opacity: 0;
                transition: all 0.5s;
            }

            .${TOOL_ID}_animations_enabled #${AI_TOOL_ID}_float_btn {
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            .${TOOL_ID}_animations_enabled #${AI_TOOL_ID}_float_btn:hover {
                transform: scale(1.1) rotate(-10deg);
                box-shadow: 0 8px 25px rgba(0,0,0,0.3);
            }

            .${TOOL_ID}_animations_enabled #${AI_TOOL_ID}_float_btn:hover:after {
                opacity: 1;
            }

            #${AI_TOOL_ID}_float_btn:active {
                transform: scale(0.95);
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            }

            /* 选择控制区样式 */
            .${TOOL_ID}_selection_controls {
                margin-bottom: 20px;
                background-color: #f9fafc;
                padding: 15px;
                border-radius: 10px;
                font-size: 14px;
                color: #333;
                box-shadow: 0 3px 10px rgba(0,0,0,0.05);
                border: 1px solid rgba(0,0,0,0.05);
                transition: all 0.3s;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_selection_controls {
                background-color: #2a2a2a;
                color: #eee;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
                border: 1px solid rgba(255,255,255,0.05);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_selection_controls:hover {
                box-shadow: 0 5px 15px rgba(0,0,0,0.08);
                transform: translateY(-2px);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_selection_controls:hover {
                box-shadow: 0 5px 15px rgba(0,0,0,0.25);
            }

            .${TOOL_ID}_selection_header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }

            .${TOOL_ID}_selection_title {
                font-weight: 600;
                display: flex;
                align-items: center;
            }

            .${TOOL_ID}_selection_title:before {
                content: '✓';
                margin-right: 8px;
                background-color: #4285f4;
                color: white;
                width: 22px;
                height: 22px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                font-size: 12px;
            }

            .${TOOL_ID}_selection_count {
                padding: 4px 10px;
                background-color: rgba(66, 133, 244, 0.1);
                border-radius: 20px;
                color: #4285f4;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.3s;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_selection_count {
                background-color: rgba(100, 181, 246, 0.1);
                color: #64b5f6;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_selection_count {
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            .${TOOL_ID}_selection_buttons {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
            }

            .${TOOL_ID}_select_btn {
                font-size: 13px;
                padding: 8px 12px;
                border-radius: 6px;
                background-color: #f1f3f5;
                color: #555;
                border: none;
                cursor: pointer;
                transition: all 0.3s;
                display: flex;
                align-items: center;
                min-width: 100px;
                justify-content: center;
            }

            .${TOOL_ID}_select_btn:before {
                margin-right: 6px;
                font-size: 14px;
            }

            .${TOOL_ID}_select_all:before {
                content: '✓';
            }

            .${TOOL_ID}_deselect_all:before {
                content: '✗';
            }

            .${TOOL_ID}_select_wrong:before {
                content: '❌';
            }

            .${TOOL_ID}_select_correct:before {
                content: '✅';
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_select_btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 3px 8px rgba(0,0,0,0.1);
                background-color: #e9ecef;
                color: #333;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_select_btn {
                background-color: #333;
                color: #bbb;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_select_btn:hover {
                background-color: #444;
                color: #eee;
                box-shadow: 0 3px 8px rgba(0,0,0,0.2);
            }

            /* 统计信息样式 */
            .${TOOL_ID}_stats_container {
                margin-bottom: 25px;
                background: linear-gradient(135deg, #f9fafc, #f1f3f6);
                padding: 18px;
                border-radius: 10px;
                font-size: 14px;
                box-shadow: 0 3px 15px rgba(0,0,0,0.05);
                border: 1px solid rgba(0,0,0,0.05);
                position: relative;
                overflow: hidden;
                transition: all 0.3s;
            }

            .${TOOL_ID}_stats_container:before {
                content: '';
                position: absolute;
                top: 0;
                right: 0;
                width: 120px;
                height: 120px;
                background: radial-gradient(circle, rgba(66, 133, 244, 0.1) 0%, rgba(66, 133, 244, 0) 70%);
                border-radius: 50%;
                transform: translate(30%, -30%);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stats_container {
                background: linear-gradient(135deg, #2a2a2a, #222);
                box-shadow: 0 3px 15px rgba(0,0,0,0.15);
                border: 1px solid rgba(255,255,255,0.05);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_stats_container:hover {
                transform: translateY(-3px);
                box-shadow: 0 6px 20px rgba(0,0,0,0.08);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stats_container:hover {
                box-shadow: 0 6px 20px rgba(0,0,0,0.25);
            }

            .${TOOL_ID}_stats_header {
                display: flex;
                align-items: center;
                margin-bottom: 15px;
                border-bottom: 1px solid rgba(0,0,0,0.05);
                padding-bottom: 10px;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stats_header {
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }

            .${TOOL_ID}_stats_title {
                font-weight: 600;
                color: #333;
                font-size: 15px;
                display: flex;
                align-items: center;
            }

            .${TOOL_ID}_stats_title:before {
                content: '📊';
                margin-right: 8px;
                font-size: 16px;
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_stats_title:before {
                display: inline-block;
                animation: ${TOOL_ID}_pulse 2s infinite;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stats_title {
                color: #eee;
            }

            .${TOOL_ID}_stats_grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
            }

            .${TOOL_ID}_stat_item {
                background-color: rgba(255,255,255,0.5);
                padding: 12px;
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                transition: all 0.3s;
                border: 1px solid rgba(0,0,0,0.03);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stat_item {
                background-color: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.03);
            }

            .${TOOL_ID}_animations_enabled .${TOOL_ID}_stat_item:hover {
                transform: translateY(-3px);
                box-shadow: 0 3px 10px rgba(0,0,0,0.05);
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stat_item:hover {
                box-shadow: 0 3px 10px rgba(0,0,0,0.15);
            }

            .${TOOL_ID}_stat_value {
                font-size: 22px;
                font-weight: 700;
                color: #4285f4;
                margin-bottom: 5px;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stat_value {
                color: #64b5f6;
            }

            .${TOOL_ID}_stat_label {
                font-size: 13px;
                color: #666;
            }

            #${BOX_ID}.dark-mode .${TOOL_ID}_stat_label {
                color: #aaa;
            }

            /* 通知提示样式 */
            .${TOOL_ID}_toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background-color: rgba(0, 0, 0, 0.85);
                color: white;
                padding: 12px 24px;
                border-radius: 30px;
                font-size: 14px;
                z-index: 10001;
                opacity: 0;
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                display: flex;
                align-items: center;
            }

            .${TOOL_ID}_toast.shown {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            .${TOOL_ID}_toast:before {
                content: '✓';
                margin-right: 10px;
                background-color: rgba(255,255,255,0.2);
                width: 22px;
                height: 22px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
            }

            .${TOOL_ID}_toast.error:before {
                content: '!';
            }

            .${TOOL_ID}_toast.success {
                background-color: rgba(46, 125, 50, 0.9);
            }

            .${TOOL_ID}_toast.error {
                background-color: rgba(211, 47, 47, 0.9);
            }

            .${TOOL_ID}_toast.info {
                background-color: rgba(25, 118, 210, 0.9);
            }
        `;

        document.head.appendChild(style);
    }

    // ===== 工具箱主体 =====
    // 创建悬浮按钮
    function createFloatingButton() {
        if (document.getElementById(FLOAT_BTN_ID)) {
            return;
        }

        const floatingBtn = document.createElement('button');
        floatingBtn.id = FLOAT_BTN_ID;
        floatingBtn.innerHTML = '📝';
        floatingBtn.title = '打开题目解析工具';
        document.body.appendChild(floatingBtn);

        floatingBtn.addEventListener('click', toggleToolBox);
    }

    // 创建AI浮动按钮
    function createAIFloatingButton() {
        const floatBtnId = AI_TOOL_ID + '_float_btn';

        // 避免重复创建
        if (document.getElementById(floatBtnId)) return;

        const button = document.createElement('button');
        button.id = floatBtnId;
        button.innerHTML = '🤖';
        button.title = 'AI解答助手设置';
        document.body.appendChild(button);

        button.addEventListener('click', function() {
            openAISettingsModal();
        });
    }

    // 切换工具箱显示状态
    function toggleToolBox() {
        let box = document.getElementById(BOX_ID);

        if (!box) {
            createToolBox();
            box = document.getElementById(BOX_ID);
        }

        if (box.style.display === 'none' || box.style.display === '') {
            box.style.display = 'block';

            // 添加动画类
            if (animationsEnabled) {
                // 先设置起始状态
                box.style.opacity = '0';
                box.style.transform = 'scale(0.9) rotate(-3deg)';

                setTimeout(() => {
                    box.classList.add('visible');
                }, 10);
            } else {
                box.style.opacity = '1';
                box.style.transform = 'none';
            }

            // 如果有数据，刷新显示
            if (allQsObject.length > 0) {
                displayQuestions(allQsObject);
            }
        } else {
            // 添加隐藏动画
            if (animationsEnabled) {
                box.classList.remove('visible');
                box.style.opacity = '0';
                box.style.transform = 'scale(0.9) rotate(3deg)';
            } else {
                box.style.opacity = '0';
                box.style.transform = 'translateY(-20px)';
            }

            setTimeout(() => {
                box.style.display = 'none';
            }, 300);
        }
    }

    // 创建工具箱
    function createToolBox() {
        if (document.getElementById(BOX_ID)) {
            return;
        }

        // 加载保存的设置
        loadSettings();

        // 设置动画全局类
        if (animationsEnabled) {
            document.body.classList.add(`${TOOL_ID}_animations_enabled`);
        } else {
            document.body.classList.remove(`${TOOL_ID}_animations_enabled`);
        }

        const box = document.createElement('div');
        box.id = BOX_ID;
        box.style.opacity = '0';
        box.style.transform = 'scale(0.9) rotate(-3deg)';

        // 应用暗色模式
        if (darkMode) {
            box.classList.add('dark-mode');
        }

        box.innerHTML = `
            <div id="${BOX_ID}_header">
                <div id="${BOX_ID}_header_title">题目解析工具</div>
                <button id="${BOX_ID}_close_btn">×</button>
            </div>
            <div id="${BOX_ID}_content">
                <h3 id="${BOX_ID}_title">题目解析</h3>

                <div class="${TOOL_ID}_tabs">
                    <button class="${TOOL_ID}_tab active" data-tab="settings">基本设置</button>
                    <button class="${TOOL_ID}_tab" data-tab="ai">AI设置</button>
                    <div class="${TOOL_ID}_tab_slider"></div>
                </div>

                <!-- 基本设置选项卡 -->
                <div class="${TOOL_ID}_tab_content active" data-tab-content="settings">
                    <!-- 设置区域 -->
                    <div class="${TOOL_ID}_switch_container">
                        <label class="${TOOL_ID}_switch">
                            <input type="checkbox" id="${BOX_ID}_hide_answers" ${hideMyAnswers ? 'checked' : ''}>
                            <span class="${TOOL_ID}_slider"></span>
                        </label>
                        <span class="${TOOL_ID}_switch_label">删除我的答案</span>
                    </div>

                    <div class="${TOOL_ID}_switch_container">
                        <label class="${TOOL_ID}_switch">
                            <input type="checkbox" id="${BOX_ID}_include_timestamp" ${includeTimestamp ? 'checked' : ''}>
                            <span class="${TOOL_ID}_slider"></span>
                        </label>
                        <span class="${TOOL_ID}_switch_label">标题添加导出时间</span>
                    </div>

                    <div class="${TOOL_ID}_switch_container">
                        <label class="${TOOL_ID}_switch">
                            <input type="checkbox" id="${BOX_ID}_show_explanation" ${showExplanation ? 'checked' : ''}>
                            <span class="${TOOL_ID}_slider"></span>
                        </label>
                        <span class="${TOOL_ID}_switch_label">显示题目解析</span>
                    </div>

                    <div class="${TOOL_ID}_switch_container">
                        <label class="${TOOL_ID}_switch">
                            <input type="checkbox" id="${BOX_ID}_dark_mode" ${darkMode ? 'checked' : ''}>
                            <span class="${TOOL_ID}_slider"></span>
                        </label>
                        <span class="${TOOL_ID}_switch_label">暗色模式</span>
                    </div>

                    <div class="${TOOL_ID}_switch_container">
                        <label class="${TOOL_ID}_switch">
                            <input type="checkbox" id="${BOX_ID}_animations" ${animationsEnabled ? 'checked' : ''}>
                            <span class="${TOOL_ID}_slider"></span>
                        </label>
                        <span class="${TOOL_ID}_switch_label">启用动画效果</span>
                    </div>

                    <!-- 自定义标题输入框 -->
                    <div>
                        <label for="${BOX_ID}_custom_title" class="${TOOL_ID}_input_label">自定义标题:</label>
                        <input type="text" id="${BOX_ID}_custom_title" class="${TOOL_ID}_input" placeholder="输入自定义标题..." value="${customTitle}">
                    </div>
                </div>

                <!-- AI设置选项卡 -->
                <div class="${TOOL_ID}_tab_content" data-tab-content="ai">
                    <div class="${TOOL_ID}_form_group">
                        <label class="${TOOL_ID}_label">选择AI模型</label>
                        <select class="${TOOL_ID}_select" id="${BOX_ID}_ai_type">
                            <option value="deepseek" ${aiSettings.apiType === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                            <option value="openai" ${aiSettings.apiType === 'openai' ? 'selected' : ''}>OpenAI</option>
                            <option value="gemini" ${aiSettings.apiType === 'gemini' ? 'selected' : ''}>Google Gemini</option>
                            <option value="anthropic" ${aiSettings.apiType === 'anthropic' ? 'selected' : ''}>Anthropic Claude</option>
                        </select>
                    </div>

                    <div class="${TOOL_ID}_form_group">
                        <label class="${TOOL_ID}_label">API密钥</label>
                        <input type="password" class="${TOOL_ID}_input" id="${BOX_ID}_api_key" value="${aiSettings.apiKey}" placeholder="输入您的API密钥">
                    </div>

                    <div class="${TOOL_ID}_form_group">
                        <label class="${TOOL_ID}_label">温度参数 (0.0-1.0)</label>
                        <input type="range" class="${TOOL_ID}_input" id="${BOX_ID}_temperature" min="0" max="1" step="0.1" value="${aiSettings.temperature}">
                        <div style="display: flex; justify-content: space-between; margin-top: 5px; color: ${darkMode ? '#aaa' : '#666'};">
                            <span>精确</span>
                            <span id="${BOX_ID}_temp_value">${aiSettings.temperature}</span>
                            <span>创意</span>
                        </div>
                    </div>

                    <div class="${TOOL_ID}_form_group">
                        <label class="${TOOL_ID}_label">默认提示词</label>
                        <textarea class="${TOOL_ID}_textarea" id="${BOX_ID}_default_prompt" placeholder="输入默认提示词模板">${aiSettings.defaultPrompt}</textarea>
                    </div>

                    <div class="${TOOL_ID}_form_group">
                        <label class="${TOOL_ID}_label">数学题提示词</label>
                        <textarea class="${TOOL_ID}_textarea" id="${BOX_ID}_math_prompt" placeholder="输入数学题提示词模板">${aiSettings.customPrompts.math}</textarea>
                    </div>

                    <div class="${TOOL_ID}_form_group">
                        <label class="${TOOL_ID}_label">英语题提示词</label>
                        <textarea class="${TOOL_ID}_textarea" id="${BOX_ID}_english_prompt" placeholder="输入英语题提示词模板">${aiSettings.customPrompts.english}</textarea>
                    </div>

                    <div class="${TOOL_ID}_form_group">
                        <label class="${TOOL_ID}_label">科学题提示词</label>
                        <textarea class="${TOOL_ID}_textarea" id="${BOX_ID}_science_prompt" placeholder="输入科学题提示词模板">${aiSettings.customPrompts.science}</textarea>
                    </div>
                </div>

                <!-- 功能按钮区 -->
                <div class="${TOOL_ID}_btn_container">
                    <button id="${BOX_ID}_parse_btn" class="${TOOL_ID}_btn">
                        <span class="${TOOL_ID}_btn_icon">📋</span>解析题目
                    </button>
                    <button id="${BOX_ID}_preview_btn" class="${TOOL_ID}_btn" disabled>
                        <span class="${TOOL_ID}_btn_icon">👁️</span>预览导出
                    </button>
                    <button id="${BOX_ID}_excel_btn" class="${TOOL_ID}_btn" disabled>
                        <span class="${TOOL_ID}_btn_icon">📊</span>下载Excel
                    </button>
                    <button id="${BOX_ID}_word_btn" class="${TOOL_ID}_btn" disabled>
                        <span class="${TOOL_ID}_btn_icon">📄</span>下载Word
                    </button>
                    <button id="${BOX_ID}_pdf_btn" class="${TOOL_ID}_btn" disabled>
                        <span class="${TOOL_ID}_btn_icon">📑</span>下载PDF
                    </button>
                </div>

                <!-- 状态指示区 -->
                <div id="${BOX_ID}_status" class="${TOOL_ID}_status">
                    <span class="${TOOL_ID}_status_icon">⏳</span>
                    <span>等待操作</span>
                </div>

                <!-- 进度条容器 -->
                <div id="${PROGRESS_CONTAINER_ID}">
                    <div id="${PROGRESS_BAR_ID}">
                        <div id="${PROGRESS_BAR_ID}_fill"></div>
                    </div>
                    <div id="${PROGRESS_BAR_ID}_text">0%</div>
                </div>

                <!-- 题目列表区域 -->
                <div id="${BOX_ID}_qlist"></div>
            </div>
        `;

        document.body.appendChild(box);

        // 更新标题
        updateTitle();

        // 添加事件监听器
        setupEventListeners();

        // 设置拖动功能
        setupDraggable();

        // 初始禁用导出按钮
        updateExportButtons();

        // 添加选项卡滑块效果
        updateTabSlider();
    }

    // 更新选项卡滑块位置
    function updateTabSlider() {
        const activeTab = document.querySelector(`.${TOOL_ID}_tab.active`);
        const slider = document.querySelector(`.${TOOL_ID}_tab_slider`);

        if (activeTab && slider) {
            slider.style.width = `${activeTab.offsetWidth}px`;
            slider.style.left = `${activeTab.offsetLeft}px`;
        }
    }

    // 设置事件监听器
    function setupEventListeners() {
        // 关闭按钮
        document.getElementById(`${BOX_ID}_close_btn`).addEventListener('click', function() {
            toggleToolBox();
        });

        // 标签切换
        document.querySelectorAll(`.${TOOL_ID}_tab`).forEach(tab => {
            tab.addEventListener('click', function() {
                // 移除所有活动标签
                document.querySelectorAll(`.${TOOL_ID}_tab`).forEach(t => t.classList.remove('active'));
                document.querySelectorAll(`.${TOOL_ID}_tab_content`).forEach(c => c.classList.remove('active'));

                // 添加活动状态到当前标签
                this.classList.add('active');
                document.querySelector(`.${TOOL_ID}_tab_content[data-tab-content="${this.dataset.tab}"]`).classList.add('active');

                // 更新滑块位置
                updateTabSlider();
            });
        });

        // 删除答案复选框
        document.getElementById(`${BOX_ID}_hide_answers`).addEventListener('change', function() {
            hideMyAnswers = this.checked;
            saveSettings();
            if (allQsObject.length > 0) {
                displayQuestions(allQsObject);
            }
        });

        // 添加时间戳复选框
        document.getElementById(`${BOX_ID}_include_timestamp`).addEventListener('change', function() {
            includeTimestamp = this.checked;
            saveSettings();
        });

        // 显示题目解析复选框
        document.getElementById(`${BOX_ID}_show_explanation`).addEventListener('change', function() {
            showExplanation = this.checked;
            saveSettings();
            if (allQsObject.length > 0) {
                displayQuestions(allQsObject);
            }
        });

        // 暗色模式切换
        document.getElementById(`${BOX_ID}_dark_mode`).addEventListener('change', function() {
            darkMode = this.checked;
            const box = document.getElementById(BOX_ID);
            if (box) {
                if (darkMode) {
                    box.classList.add('dark-mode');
                } else {
                    box.classList.remove('dark-mode');
                }
            }
            saveSettings();
        });

        // 动画效果切换
        document.getElementById(`${BOX_ID}_animations`).addEventListener('change', function() {
            animationsEnabled = this.checked;
            if (animationsEnabled) {
                document.body.classList.add(`${TOOL_ID}_animations_enabled`);
            } else {
                document.body.classList.remove(`${TOOL_ID}_animations_enabled`);
            }
            saveSettings();
        });

        // 自定义标题输入框
        document.getElementById(`${BOX_ID}_custom_title`).addEventListener('input', function() {
            customTitle = this.value.trim();
            saveSettings();
            updateTitle();
        });

        // AI设置相关
        document.getElementById(`${BOX_ID}_ai_type`).addEventListener('change', function() {
            aiSettings.apiType = this.value;
            saveSettings();
        });

        document.getElementById(`${BOX_ID}_api_key`).addEventListener('change', function() {
            aiSettings.apiKey = this.value.trim();
            saveSettings();
        });

        // 温度滑块
        const tempSlider = document.getElementById(`${BOX_ID}_temperature`);
        const tempValue = document.getElementById(`${BOX_ID}_temp_value`);

        tempSlider.addEventListener('input', function() {
            tempValue.textContent = this.value;
            aiSettings.temperature = parseFloat(this.value);
            saveSettings();
        });

        document.getElementById(`${BOX_ID}_default_prompt`).addEventListener('input', function() {
            aiSettings.defaultPrompt = this.value.trim();
            saveSettings();
        });

        // 添加自定义提示词的事件监听器
        document.getElementById(`${BOX_ID}_math_prompt`).addEventListener('input', function() {
            aiSettings.customPrompts.math = this.value.trim();
            saveSettings();
        });

        document.getElementById(`${BOX_ID}_english_prompt`).addEventListener('input', function() {
            aiSettings.customPrompts.english = this.value.trim();
            saveSettings();
        });

        document.getElementById(`${BOX_ID}_science_prompt`).addEventListener('input', function() {
            aiSettings.customPrompts.science = this.value.trim();
            saveSettings();
        });

        // 解析按钮
        document.getElementById(`${BOX_ID}_parse_btn`).addEventListener('click', function() {
            // 清空数据并重新解析
            allQsObject = [];
            allStr = "";
            updateStatus("开始解析题目...", "active");
            setProcessingState(true);
            parseQuestions();
        });

        // 预览按钮
        document.getElementById(`${BOX_ID}_preview_btn`).addEventListener('click', function() {
            if (allQsObject.length === 0 && selectedQuestions.size === 0) {
                showToast("没有题目可供预览", "error");
                return;
            }

            if (isProcessing) {
                return;
            }

            openPreviewModal();
        });

        // Excel导出按钮
        document.getElementById(`${BOX_ID}_excel_btn`).addEventListener('click', function() {
            if ((allQsObject.length === 0 && selectedQuestions.size === 0) || isProcessing) {
                return;
            }

            if (selectedQuestions.size === 0) {
                if (!confirm("您没有选择任何题目，将导出所有题目。是否继续？")) {
                    return;
                }
            }

            updateStatus("正在生成Excel文件...", "active");
            setProcessingState(true);
            const exportData = prepareExportData();
            downloadExcel(exportData.data, exportData.baseFilename + ".xlsx");
        });

        // Word导出按钮
        document.getElementById(`${BOX_ID}_word_btn`).addEventListener('click', function() {
            if ((allQsObject.length === 0 && selectedQuestions.size === 0) || isProcessing) {
                return;
            }

            if (selectedQuestions.size === 0) {
                if (!confirm("您没有选择任何题目，将导出所有题目。是否继续？")) {
                    return;
                }
            }

            updateStatus("正在生成Word文件...", "active");
            setProcessingState(true);
            const exportData = prepareExportData();
            downloadWord(exportData.data, exportData.baseFilename + ".docx");
        });

        // PDF导出按钮
        document.getElementById(`${BOX_ID}_pdf_btn`).addEventListener('click', function() {
            if ((allQsObject.length === 0 && selectedQuestions.size === 0) || isProcessing) {
                return;
            }

            if (selectedQuestions.size === 0) {
                if (!confirm("您没有选择任何题目，将导出所有题目。是否继续？")) {
                    return;
                }
            }

            updateStatus("正在生成PDF文件...", "active");
            setProcessingState(true);
            const exportData = prepareExportData();
            downloadPDF(exportData.data, exportData.baseFilename + ".pdf");
        });
    }

    // 设置拖动功能
    function setupDraggable() {
        const header = document.getElementById(`${BOX_ID}_header`);
        const box = document.getElementById(BOX_ID);

        if (!header || !box) return;

        let isDragging = false;
        let offsetX, offsetY;

        header.addEventListener('mousedown', function(e) {
            isDragging = true;
            offsetX = e.clientX - box.getBoundingClientRect().left;
            offsetY = e.clientY - box.getBoundingClientRect().top;

            // 添加拖动时的视觉效果
            box.style.transition = "none";
            box.style.opacity = "0.9";

            if (animationsEnabled) {
                box.style.boxShadow = "0 15px 40px rgba(0,0,0,0.2)";
            }
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;

            box.style.left = (e.clientX - offsetX) + 'px';
            box.style.top = (e.clientY - offsetY) + 'px';
            box.style.right = 'auto';
        });

        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                // 恢复正常外观
                box.style.transition = animationsEnabled ?
                    "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)" :
                    "opacity 0.3s, transform 0.3s";
                box.style.opacity = "1";

                if (animationsEnabled) {
                    box.style.boxShadow = "";
                }
            }
        });
    }

    // 更新工具箱标题
    function updateTitle() {
        const titleElement = document.querySelector(".mark_title");
        const titleDisplay = document.getElementById(`${BOX_ID}_title`);
        const customTitleInput = document.getElementById(`${BOX_ID}_custom_title`);

        if (titleDisplay) {
            const pageTitle = titleElement ? titleElement.innerText : "题目解析";
            titleDisplay.textContent = customTitle || pageTitle;
        }

        // 更新自定义标题输入框
        if (customTitleInput) {
            customTitleInput.value = customTitle || "";
        }
    }

    // 更新导出按钮状态
    function updateExportButtons() {
        const hasData = allQsObject.length > 0;
        const previewBtn = document.getElementById(`${BOX_ID}_preview_btn`);
        const excelBtn = document.getElementById(`${BOX_ID}_excel_btn`);
        const wordBtn = document.getElementById(`${BOX_ID}_word_btn`);
        const pdfBtn = document.getElementById(`${BOX_ID}_pdf_btn`);

        if (previewBtn) previewBtn.disabled = !hasData || isProcessing;
        if (excelBtn) excelBtn.disabled = !hasData || isProcessing;
        if (wordBtn) wordBtn.disabled = !hasData || isProcessing;
        if (pdfBtn) pdfBtn.disabled = !hasData || isProcessing;
    }

    // 设置处理状态
    function setProcessingState(processing) {
        isProcessing = processing;

        // 更新按钮状态
        const parseBtn = document.getElementById(`${BOX_ID}_parse_btn`);
        if (parseBtn) {
            if (processing) {
                parseBtn.innerHTML = `<span class="${TOOL_ID}_loading"></span>处理中...`;
                parseBtn.disabled = true;
            } else {
                parseBtn.innerHTML = `<span class="${TOOL_ID}_btn_icon">📋</span>解析题目`;
                parseBtn.disabled = false;
            }
        }

        // 更新导出按钮状态
        updateExportButtons();
    }

    // 更新状态信息
    function updateStatus(message, type = "") {
        const statusElement = document.getElementById(`${BOX_ID}_status`);
        if (!statusElement) return;

        // 移除所有状态类
        statusElement.classList.remove('active', 'success', 'error');

        // 设置图标和类型
        let icon = "⏳";
        if (type === "active") {
            statusElement.classList.add('active');
            icon = "🔄";
        } else if (type === "success") {
            statusElement.classList.add('success');
            icon = "✅";
        } else if (type === "error") {
            statusElement.classList.add('error');
            icon = "❌";
        }

        statusElement.innerHTML = `<span class="${TOOL_ID}_status_icon">${icon}</span><span>${message}</span>`;
    }

    // 显示进度条
    function showProgressBar() {
        const progressContainer = document.getElementById(PROGRESS_CONTAINER_ID);
        if (progressContainer) {
            progressContainer.style.display = 'block';
        }
        updateProgress(0, '初始化中...');
    }

    // 隐藏进度条
    function hideProgressBar() {
        const progressContainer = document.getElementById(PROGRESS_CONTAINER_ID);
        if (progressContainer) {
            progressContainer.style.display = 'none';
        }
    }

    // 更新进度条
    function updateProgress(percent, text) {
        const progressFill = document.getElementById(`${PROGRESS_BAR_ID}_fill`);
        const progressText = document.getElementById(`${PROGRESS_BAR_ID}_text`);

        if (progressFill && progressText) {
            // 确保百分比在0-100之间
            const safePercent = Math.max(0, Math.min(100, percent));
            progressFill.style.width = `${safePercent}%`;

            // 更新文本，如果没有提供则显示百分比
            progressText.textContent = text || `${Math.round(safePercent)}%`;
        }
    }

    // 显示通知提示
    function showToast(message, type = "info", duration = 3000) {
        // 移除已存在的通知
        let toast = document.querySelector(`.${TOOL_ID}_toast`);
        if (toast) {
            document.body.removeChild(toast);
        }

        // 创建新通知
        toast = document.createElement('div');
        toast.className = `${TOOL_ID}_toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // 显示通知
        setTimeout(() => {
            toast.classList.add('shown');
        }, 10);

        // 设置通知自动消失
        setTimeout(() => {
            toast.classList.remove('shown');
            setTimeout(() => {
                if (toast && toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    // ===== 题目解析功能 =====
    // 解析问题
    function parseQuestions() {
        const qlistElement = document.getElementById(`${BOX_ID}_qlist`);
        const nodeBox = document.getElementsByClassName("mark_item");

        if (nodeBox.length === 0) {
            if (qlistElement) {
                qlistElement.innerHTML = `
                    <div class="${TOOL_ID}_empty_state">
                        <div class="${TOOL_ID}_empty_icon">📝</div>
                        <div class="${TOOL_ID}_empty_text">未找到试题内容</div>
                        <div>请确认当前页面包含试题数据</div>
                    </div>
                `;
                updateStatus("未找到题目内容", "error");
                setProcessingState(false);
            }
            return;
        }

        // 记录页面上的所有图片
        const totalImages = document.querySelectorAll("img").length;
        console.log(`页面上共有 ${totalImages} 个图片元素`);
        updateStatus(`分析页面结构...找到 ${totalImages} 个图片元素`, "active");

        const imagePromises = [];

        Array.from(nodeBox).forEach(qNode => {
            let node = { nodeName: "", nodeList: [] };
            const typeTitle = qNode.querySelector(".type_tit")?.innerText || "未命名题型";
            allStr += `${typeTitle}\n`;
            node.nodeName = typeTitle;

            const questions = qNode.querySelectorAll(".questionLi");
            if (questions.length === 0) {
                console.log(`No questions found in section: ${typeTitle}`);
            }

            questions.forEach(question => {
                let qItem = { slt: [], q: "", myAn: "", an: "", explanation: "", images: [] };
                const qNameElement = question.querySelector(".mark_name");
                const qName = qNameElement?.innerText || "未找到题目";
                allStr += `${qName}\n`;
                qItem.q = qName;

                // 查找题目中的图片
                let questionImages = [];
                let uniqueImageUrls = new Set();

                if (question) {
                    questionImages = findAllImages(question);
                    console.log(`题目 "${qItem.q.substring(0, 20)}..." 中找到 ${questionImages.length} 个图片`);
                }

                if (questionImages && questionImages.length > 0) {
                    // 处理每个图片
                    questionImages.forEach(img => {
                        // 确保获取完整的图片URL
                        const imgSrc = img.src || img.getAttribute("src");
                        if (imgSrc && !uniqueImageUrls.has(imgSrc)) {
                            uniqueImageUrls.add(imgSrc);

                            // 创建一个Promise来处理图片
                            const imgPromise = getImageAsBase64(imgSrc)
                                .then(base64Data => {
                                    // 保存图片的URL和数据
                                    qItem.images.push({
                                        src: imgSrc,
                                        alt: img.alt || "题目图片",
                                        data: base64Data,
                                        width: img.naturalWidth || 0,
                                        height: img.naturalHeight || 0
                                    });
                                    console.log(`成功获取图片: ${imgSrc.substring(0, 50)}...`);
                                })
                                .catch(error => {
                                    console.error(`获取图片失败: ${imgSrc}`, error);
                                    // 即使失败，也把图片URL保存下来
                                    qItem.images.push({
                                        src: imgSrc,
                                        alt: img.alt || "题目图片",
                                        data: null,
                                        width: img.naturalWidth || 0,
                                        height: img.naturalHeight || 0
                                    });
                                });

                            imagePromises.push(imgPromise);
                        }
                    });
                }

                // 选项
                const qSelectBox = question.querySelector(".mark_letter");
                if (qSelectBox) {
                    const qSelectItems = qSelectBox.getElementsByTagName("li");
                    Array.from(qSelectItems).forEach(qSelectItem => {
                        const qSelectText = qSelectItem.innerText;
                        if (qSelectText) {
                            allStr += `${qSelectText}\n`;
                            qItem.slt.push(qSelectText);
                        }
                    });
                }

                // 答案
                try {
                    const qAnswer = question.querySelector(".mark_answer .colorGreen")?.innerText || "";
                    const qMyAnswer = question.querySelector(".mark_answer .colorDeep")?.innerText || "";
                    allStr += `${qMyAnswer}\n${qAnswer}\n`;
                    qItem.myAn = qMyAnswer;
                    qItem.an = qAnswer;

                    // 尝试获取题目解析
                    const qExplanation = question.querySelector(".mark_explain")?.innerText ||
                                        question.querySelector(".explanation")?.innerText ||
                                        question.querySelector(".q_analysis")?.innerText ||
                                        question.querySelector(".analyze")?.innerText || "";

                    if (qExplanation) {
                        allStr += `${qExplanation}\n`;
                        qItem.explanation = qExplanation;
                    }
                } catch (err) {
                    console.log("Error parsing answers or explanation:", err);
                }

                node.nodeList.push(qItem);
            });

            allQsObject.push(node);
        });

        // 等待所有图片处理完成
        if (imagePromises.length > 0) {
            updateStatus(`正在处理 ${imagePromises.length} 个图片...`, "active");
            showProgressBar();

            // 添加进度监控
            let completedImages = 0;
            const totalImages = imagePromises.length;

            const progressPromises = imagePromises.map(promise =>
                promise.finally(() => {
                    completedImages++;
                    const percent = Math.floor((completedImages / totalImages) * 100);
                    updateProgress(percent, `处理图片 ${completedImages}/${totalImages}`);
                })
            );

            Promise.all(progressPromises)
                .then(() => {
                    console.log("所有图片已处理完成");
                    updateStatus(`解析完成，共处理 ${imagePromises.length} 个图片`, "success");
                    hideProgressBar();
                    displayQuestions(allQsObject);
                    setProcessingState(false);

                    // 使用动画显示成功反馈
                    if (animationsEnabled) {
                        showToast("题目解析完成！", "success");
                    }
                })
                .catch(error => {
                    console.error("处理图片时出错:", error);
                    updateStatus("处理图片时出错，但已显示可用内容", "error");
                    hideProgressBar();
                    displayQuestions(allQsObject);
                    setProcessingState(false);

                    // 使用动画显示错误反馈
                    if (animationsEnabled) {
                        showToast("处理图片时出错，但已显示可用内容", "error");
                    }
                });
        } else {
            updateStatus("解析完成，未发现图片", "success");
            displayQuestions(allQsObject);
            setProcessingState(false);

            // 使用动画显示成功反馈
            if (animationsEnabled) {
                showToast("题目解析完成！", "success");
            }
        }

        console.log("解析完成, 找到题目总数:",
                    allQsObject.reduce((sum, node) => sum + node.nodeList.length, 0));

        // 更新导出按钮状态
        updateExportButtons();
    }

    // 显示问题 - 支持选择功能和AI解答
    function displayQuestions(qObject) {
        const qlistElement = document.getElementById(`${BOX_ID}_qlist`);
        if (!qlistElement) return;

        // 清空已选题目
        selectedQuestions.clear();
        lastSelectedQuestionId = null;

        // 题目总数和统计信息
        const totalQuestions = qObject.reduce((sum, node) => sum + node.nodeList.length, 0);
        let correctCount = 0;
        let wrongCount = 0;

        // 计算正确和错误题目数量
        qObject.forEach(node => {
            node.nodeList.forEach(qItem => {
                if (qItem.myAn && qItem.an) {
                    if (qItem.myAn === qItem.an) {
                        correctCount++;
                    } else {
                        wrongCount++;
                    }
                }
            });
        });

        if (totalQuestions === 0) {
            qlistElement.innerHTML = `
                <div class="${TOOL_ID}_empty_state">
                    <div class="${TOOL_ID}_empty_icon">📝</div>
                    <div class="${TOOL_ID}_empty_text">未找到题目</div>
                    <div>请点击"解析题目"按钮开始解析</div>
                </div>
            `;
            return;
        }

        // 题目选择控制区
        const selectionControlsHtml = `
            <div class="${TOOL_ID}_selection_controls">
                <div class="${TOOL_ID}_selection_header">
                    <div class="${TOOL_ID}_selection_title">题目选择</div>
                    <div class="${TOOL_ID}_selection_count" id="${TOOL_ID}_selection_count">已选: 0/${totalQuestions}</div>
                </div>
                <div class="${TOOL_ID}_selection_buttons">
                    <button id="${TOOL_ID}_select_all" class="${TOOL_ID}_select_btn ${TOOL_ID}_select_all">全选</button>
                    <button id="${TOOL_ID}_deselect_all" class="${TOOL_ID}_select_btn ${TOOL_ID}_deselect_all">取消全选</button>
                    <button id="${TOOL_ID}_select_wrong" class="${TOOL_ID}_select_btn ${TOOL_ID}_select_wrong">选择错题</button>
                    <button id="${TOOL_ID}_select_correct" class="${TOOL_ID}_select_btn ${TOOL_ID}_select_correct">选择正确题</button>
                </div>
            </div>
        `;

        // 统计信息区域
        const statsHtml = `
            <div class="${TOOL_ID}_stats_container">
                <div class="${TOOL_ID}_stats_header">
                    <div class="${TOOL_ID}_stats_title">题目统计</div>
                </div>
                <div class="${TOOL_ID}_stats_grid">
                    <div class="${TOOL_ID}_stat_item">
                        <div class="${TOOL_ID}_stat_value">${totalQuestions}</div>
                        <div class="${TOOL_ID}_stat_label">题目总数</div>
                    </div>
                    <div class="${TOOL_ID}_stat_item">
                        <div class="${TOOL_ID}_stat_value">${qObject.length}</div>
                        <div class="${TOOL_ID}_stat_label">题型数量</div>
                    </div>
                    <div class="${TOOL_ID}_stat_item">
                        <div class="${TOOL_ID}_stat_value">${correctCount}</div>
                        <div class="${TOOL_ID}_stat_label">正确题目</div>
                    </div>
                    <div class="${TOOL_ID}_stat_item">
                        <div class="${TOOL_ID}_stat_value">${wrongCount}</div>
                        <div class="${TOOL_ID}_stat_label">错误题目</div>
                    </div>
                </div>
            </div>
        `;

        let sectionsHtml = "";
        let questionIdCounter = 0; // 用于生成唯一的题目ID

        qObject.forEach((qNode) => {
            let questionsHtml = "";

            qNode.nodeList.forEach((qItem, index) => {
                // 为每个题目分配一个唯一ID
                const questionId = `q_${questionIdCounter++}`;
                qItem.id = questionId; // 在原始数据中也存储ID，方便后续处理

                // 处理选项
                let optionsHtml = "";
                if (qItem.slt.length > 0) {
                    optionsHtml = `
                        <div class="${TOOL_ID}_question_options">
                            ${qItem.slt.map(opt => `<div class="${TOOL_ID}_question_option">${opt}</div>`).join('')}
                        </div>
                    `;
                }

                // 处理答案
                const myAnswerHtml = hideMyAnswers
                    ? ''
                    : `<div class="${TOOL_ID}_my_answer">我的答案: ${qItem.myAn}</div>`;

                // 答案匹配指示
                const mismatchHtml = (!hideMyAnswers && qItem.myAn && qItem.an && qItem.myAn !== qItem.an)
                    ? `<div class="${TOOL_ID}_mismatch_indicator">答案不匹配</div>`
                    : '';

                // 处理题目解析
                const explanationHtml = showExplanation && qItem.explanation
                    ? `
                        <div class="${TOOL_ID}_explanation">
                            <div class="${TOOL_ID}_explanation_title">题目解析:</div>
                            <div>${qItem.explanation}</div>
                        </div>
                      `
                    : '';

                // 处理图片
                let imagesHtml = '';
                if (qItem.images && qItem.images.length > 0) {
                    qItem.images.forEach(img => {
                        const imgUrl = img.data || img.src;
                        imagesHtml += `
                            <div class="${TOOL_ID}_img_container">
                                <img class="${TOOL_ID}_img" src="${imgUrl}" alt="${img.alt}" loading="lazy">
                                <div class="${TOOL_ID}_img_caption">${img.alt}</div>
                            </div>
                        `;
                    });
                }

                // AI解答按钮
                const aiButtonHtml = `
                    <div style="margin-top: 10px; display: flex; align-items: center;">
                        <button class="${AI_TOOL_ID}_btn" data-question-id="${questionId}">
                            <span style="margin-right: 6px;">🤖</span>AI解答
                        </button>
                        <button class="${AI_TOOL_ID}_config_btn" data-question-id="${questionId}" title="AI设置">⚙️</button>
                    </div>
                    <div id="${AI_ANSWER_ID}_${questionId}" style="display: none;"></div>
                `;

                // 题目选择框
                const checkboxHtml = `
                    <div class="${TOOL_ID}_question_checkbox">
                        <label class="${TOOL_ID}_checkbox_container">
                            <input type="checkbox" class="${TOOL_ID}_question_selector" data-question-id="${questionId}">
                            <span class="${TOOL_ID}_checkbox_checkmark"></span>
                        </label>
                    </div>
                `;

                // 判断是否为错题
                const isWrong = !hideMyAnswers && qItem.myAn && qItem.an && qItem.myAn !== qItem.an;
                const isCorrect = !hideMyAnswers && qItem.myAn && qItem.an && qItem.myAn === qItem.an;

                // 添加数据属性，用于筛选
                const dataAttributes = `
                    data-question-id="${questionId}"
                    data-question-type="${qNode.nodeName}"
                    data-is-wrong="${isWrong ? 'true' : 'false'}"
                    data-is-correct="${isCorrect ? 'true' : 'false'}"
                `;

                const questionHtml = `
                    <div class="${TOOL_ID}_question_item" ${dataAttributes}>
                        <div class="${TOOL_ID}_question_header">
                            ${checkboxHtml}
                            <div class="${TOOL_ID}_question_title">${qItem.q}</div>
                        </div>
                        ${imagesHtml}
                        ${optionsHtml}
                        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                            ${myAnswerHtml}
                            <div class="${TOOL_ID}_correct_answer">正确答案: ${qItem.an}</div>
                            ${mismatchHtml}
                        </div>
                        ${explanationHtml}
                        ${aiButtonHtml}
                    </div>
                `;

                questionsHtml += questionHtml;

                // 记录问题数据用于AI解答
                activeQuestions[questionId] = {
                    questionText: qItem.q,
                    options: qItem.slt,
                    correctAnswer: qItem.an,
                    myAnswer: qItem.myAn,
                    explanation: qItem.explanation
                };
            });

            const sectionHtml = `
                <div class="${TOOL_ID}_question_section">
                    <div class="${TOOL_ID}_question_section_title">${qNode.nodeName} (${qNode.nodeList.length}题)</div>
                    ${questionsHtml}
                </div>
            `;

            sectionsHtml += sectionHtml;
        });

        qlistElement.innerHTML = selectionControlsHtml + statsHtml + sectionsHtml;

        // 添加动画效果
        if (animationsEnabled) {
            // 添加动画到题目区域
            const sections = document.querySelectorAll(`.${TOOL_ID}_question_section`);
            sections.forEach((section, index) => {
                setTimeout(() => {
                    section.classList.add('animated');
                }, index * 100); // 错开时间添加动画效果
            });
        }

        // 添加题目选择事件监听
        setupQuestionSelectionListeners();

        // 添加AI解答按钮事件监听
        setupAIAnswerListeners();

        // 更新选中计数
        updateSelectionCount();
    }

    // 添加题目选择相关的事件监听器
    function setupQuestionSelectionListeners() {
        // 单个题目复选框点击
        document.querySelectorAll(`.${TOOL_ID}_question_selector`).forEach(checkbox => {
            checkbox.addEventListener('click', function(e) {
                const questionId = this.dataset.questionId;

                // Shift+点击 支持多选
                if (e.shiftKey && lastSelectedQuestionId) {
                    const checkboxes = Array.from(document.querySelectorAll(`.${TOOL_ID}_question_selector`));
                    const currentIndex = checkboxes.indexOf(this);
                    const lastIndex = checkboxes.findIndex(cb => cb.dataset.questionId === lastSelectedQuestionId);

                    const start = Math.min(currentIndex, lastIndex);
                    const end = Math.max(currentIndex, lastIndex);

                    for (let i = start; i <= end; i++) {
                        const cb = checkboxes[i];
                        cb.checked = this.checked;

                        if (this.checked) {
                            selectedQuestions.add(cb.dataset.questionId);
                        } else {
                            selectedQuestions.delete(cb.dataset.questionId);
                        }
                    }
                } else {
                    // 普通点击
                    if (this.checked) {
                        selectedQuestions.add(questionId);
                    } else {
                        selectedQuestions.delete(questionId);
                    }

                    lastSelectedQuestionId = questionId;
                }

                updateSelectionCount();
            });
        });

        // 全选按钮
        document.getElementById(`${TOOL_ID}_select_all`).addEventListener('click', function() {
            document.querySelectorAll(`.${TOOL_ID}_question_selector`).forEach(checkbox => {
                checkbox.checked = true;
                selectedQuestions.add(checkbox.dataset.questionId);
            });
            updateSelectionCount();

            // 添加动画反馈
            if (animationsEnabled) {
                showToast(`已选择全部 ${selectedQuestions.size} 个题目`, "success");
            }
        });

        // 取消全选按钮
        document.getElementById(`${TOOL_ID}_deselect_all`).addEventListener('click', function() {
            document.querySelectorAll(`.${TOOL_ID}_question_selector`).forEach(checkbox => {
                checkbox.checked = false;
                selectedQuestions.delete(checkbox.dataset.questionId);
            });
            updateSelectionCount();

            // 添加动画反馈
            if (animationsEnabled) {
                showToast("已取消全部选择", "info");
            }
        });

        // 选择错题按钮
        document.getElementById(`${TOOL_ID}_select_wrong`).addEventListener('click', function() {
            // 先清空选择
            selectedQuestions.clear();
            document.querySelectorAll(`.${TOOL_ID}_question_selector`).forEach(checkbox => {
                checkbox.checked = false;
            });

            // 选中错题
            const wrongItems = document.querySelectorAll(`.${TOOL_ID}_question_item[data-is-wrong="true"]`);
            wrongItems.forEach(item => {
                const questionId = item.dataset.questionId;
                const checkbox = item.querySelector(`.${TOOL_ID}_question_selector`);
                if (checkbox) {
                    checkbox.checked = true;
                    selectedQuestions.add(questionId);
                }

                // 添加动画效果来高亮显示选中的错题
                if (animationsEnabled) {
                    item.style.animation = `${TOOL_ID}_highlight 1s`;
                    setTimeout(() => {
                        item.style.animation = '';
                    }, 1000);
                }
            });
            updateSelectionCount();

            // 添加动画反馈
            if (animationsEnabled) {
                showToast(`已选择 ${wrongItems.length} 道错题`, "info");
            }
        });

        // 选择正确题按钮
        document.getElementById(`${TOOL_ID}_select_correct`).addEventListener('click', function() {
            // 先清空选择
            selectedQuestions.clear();
            document.querySelectorAll(`.${TOOL_ID}_question_selector`).forEach(checkbox => {
                checkbox.checked = false;
            });

            // 选中正确题
            const correctItems = document.querySelectorAll(`.${TOOL_ID}_question_item[data-is-correct="true"]`);
            correctItems.forEach(item => {
                const questionId = item.dataset.questionId;
                const checkbox = item.querySelector(`.${TOOL_ID}_question_selector`);
                if (checkbox) {
                    checkbox.checked = true;
                    selectedQuestions.add(questionId);
                }

                // 添加动画效果来高亮显示选中的正确题
                if (animationsEnabled) {
                    item.style.animation = `${TOOL_ID}_highlight 1s`;
                    setTimeout(() => {
                        item.style.animation = '';
                    }, 1000);
                }
            });
            updateSelectionCount();

            // 添加动画反馈
            if (animationsEnabled) {
                showToast(`已选择 ${correctItems.length} 道正确题`, "success");
            }
        });
    }

    // 更新选中题目的数量显示
    function updateSelectionCount() {
        const totalQuestions = document.querySelectorAll(`.${TOOL_ID}_question_selector`).length;
        const countElement = document.getElementById(`${TOOL_ID}_selection_count`);

        if (countElement) {
            countElement.textContent = `已选: ${selectedQuestions.size}/${totalQuestions}`;

            // 如果有题目被选中，启用导出按钮，否则禁用
            const exportButtons = document.querySelectorAll(`#${BOX_ID}_excel_btn, #${BOX_ID}_word_btn, #${BOX_ID}_pdf_btn, #${BOX_ID}_preview_btn`);
            exportButtons.forEach(button => {
                button.disabled = (selectedQuestions.size === 0 && allQsObject.length === 0) || isProcessing;
            });
        }
    }

    // 查找所有图片 - 针对学习通页面结构优化
    function findAllImages(element) {
        if (!element) return [];

        let images = [];

        // 1. 直接查找所有图片标签
        try {
            const directImages = element.querySelectorAll('img');
            if (directImages && directImages.length > 0) {
                directImages.forEach(img => {
                    if (img.src) {
                        images.push(img);
                    }
                });
            }
        } catch (e) {
            console.error("查找直接图片失败:", e);
        }

        // 2. 特别处理学习通的特殊图片容器
        try {
            // 查找可能包含图片的特殊容器
            const imgContainers = element.querySelectorAll('.imag_box, .mark_img, .imgBox, .mc img, .q_content img');
            imgContainers.forEach(container => {
                if (container.tagName && container.tagName.toLowerCase() === 'img') {
                    // 如果容器本身就是img标签
                    if (container.src && !images.some(existingImg => existingImg.src === container.src)) {
                        images.push(container);
                    }
                } else {
                    // 如果容器是div等元素，查找其中的img
                    const containerImages = container.querySelectorAll('img');
                    containerImages.forEach(img => {
                        if (img.src && !images.some(existingImg => existingImg.src === img.src)) {
                            images.push(img);
                        }
                    });
                }
            });
        } catch (e) {
            console.error("查找容器中的图片失败:", e);
        }

        return images;
    }

    // 使用Fetch API获取图片并转换为Base64
    function getImageAsBase64(url) {
        return new Promise((resolve, reject) => {
            // 检查URL是否有效
            if (!url || url.trim() === '' || !url.match(/^(http|https|data)/i)) {
                return reject(new Error('无效的图片URL'));
            }

            // 对于已经是base64的数据，直接返回
            if (url.startsWith('data:image')) {
                return resolve(url);
            }

            // 构建安全的URL（处理相对路径）
            let safeUrl = url;
            if (url.startsWith('//')) {
                safeUrl = window.location.protocol + url;
            } else if (url.startsWith('/')) {
                safeUrl = window.location.origin + url;
            }

            // 创建新的图片对象
            const img = new Image();
            img.crossOrigin = 'Anonymous'; // 尝试解决跨域问题

            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth || img.width;
                    canvas.height = img.naturalHeight || img.height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    // 获取Base64数据
                    const dataURL = canvas.toDataURL('image/png');
                    resolve(dataURL);
                } catch (e) {
                    console.error('转换图片到Base64失败:', e);
                    // 如果转换失败，则返回原始URL
                    resolve(url);
                }
            };

            img.onerror = function() {
                console.error(`加载图片失败: ${safeUrl}`);
                // 如果加载失败，则返回原始URL
                resolve(url);
            };

            // 设置src开始加载图片
            img.src = safeUrl;
        });
    }

    // 准备导出数据 - 支持选择性导出
    function prepareExportData() {
        const titleElement = document.querySelector(".mark_title");
        // 使用自定义标题（如果有），否则使用页面标题
        let baseFilename = customTitle || (titleElement ? titleElement.innerText : "题目解析");

        // 如果是空字符串，使用默认标题
        if (!baseFilename || baseFilename.trim() === "") {
            baseFilename = "题目解析";
        }

        // 如果启用了时间戳选项，添加当前时间作为后缀
        if (includeTimestamp) {
            const now = new Date();
            const timeStr = now.getFullYear() +
                      ('0' + (now.getMonth() + 1)).slice(-2) +
                      ('0' + now.getDate()).slice(-2) + '_' +
                      ('0' + now.getHours()).slice(-2) +
                      ('0' + now.getMinutes()).slice(-2);
            baseFilename += '_' + timeStr;
        }

        // 如果已选中题目，添加选中数量信息
        if (selectedQuestions.size > 0 && selectedQuestions.size < document.querySelectorAll(`.${TOOL_ID}_question_selector`).length) {
            baseFilename += `_已选${selectedQuestions.size}题`;
        }

        // 修改数据处理逻辑，只包含选中的题目
        const data = [];

        allQsObject.forEach(qNode => {
            qNode.nodeList.forEach(qItem => {
                // 如果没有题目被选中，则导出所有题目
                // 如果有题目被选中，则只导出被选中的题目
                if (selectedQuestions.size === 0 || selectedQuestions.has(qItem.id)) {
                    const exportItem = {
                        '题目类型': qNode.nodeName,
                        '题目': qItem.q,
                        '选项': qItem.slt.join("\n"),
                        '我的答案': hideMyAnswers ? '[已隐藏]' : qItem.myAn,
                        '正确答案': qItem.an,
                        '是否正确': hideMyAnswers ? '-' : (qItem.myAn === qItem.an ? '✓' : '✗'),
                        '题目解析': qItem.explanation || '-',
                        'aiAnswer': qItem.aiAnswer || null  // 添加AI解答
                    };

                    // 添加图片信息
                    exportItem['图片'] = qItem.images && qItem.images.length > 0 ? qItem.images : null;

                    data.push(exportItem);
                }
            });
        });

        return { data, baseFilename };
    }

    // 下载Excel
    function downloadExcel(data, filename) {
        if (!data || data.length === 0) {
            updateStatus('没有数据可供下载', 'error');
            setProcessingState(false);
            return;
        }

        try {
            updateStatus("正在创建Excel文件...", "active");

            // 检查XLSX是否可用
            if (typeof XLSX === 'undefined') {
                updateStatus("错误: XLSX库未加载，请检查脚本设置中的 @require", "error");
                setProcessingState(false);
                return;
            }

            // 预处理数据，删除不能放入Excel的图片数据
            const processedData = data.map(item => {
                const newItem = {...item};
                if (newItem['图片']) {
                    newItem['图片'] = newItem['图片'].length > 0 ? `包含${newItem['图片'].length}张图片` : '无图片';
                }
                return newItem;
            });
            const worksheet = XLSX.utils.json_to_sheet(processedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "试题");

            // 自动调整列宽
            const colWidths = processedData.reduce((widths, row) => {
                Object.keys(row).forEach(key => {
                    const value = String(row[key] || '');
                    const maxLineLength = value.split('\n').reduce((max, line) =>
                        Math.max(max, line.length), 0);
                    widths[key] = Math.max(widths[key] || 0, maxLineLength, key.length);
                });
                return widths;
            }, {});

            worksheet['!cols'] = Object.keys(colWidths).map(key => ({
                wch: Math.min(colWidths[key] + 2, 50)  // 最大宽度50个字符
            }));

            XLSX.writeFile(workbook, filename);
            updateStatus(`Excel文件已生成: ${filename}`, "success");
            setProcessingState(false);

            // 添加动画反馈
            if (animationsEnabled) {
                showToast(`Excel文件已成功生成: ${filename}`, "success");
            }
        } catch (error) {
            console.error("下载Excel失败:", error);
            updateStatus(`下载Excel失败: ${error.message}`, "error");
            setProcessingState(false);

            // 添加错误反馈
            if (animationsEnabled) {
                showToast(`下载Excel失败: ${error.message}`, "error");
            }
        }
    }

    // 处理题目标题，去除重复编号
    function processQuestionTitle(title, index) {
        if (!title) return `${index + 1}. `;

        // 清理各种可能的编号格式
        let cleanTitle = title.trim();

        // 检查是否已有编号
        const hasNumbering = /^\s*(?:\d+[\s.、．]|[（(]\s*\d+\s*[)）]|第\s*\d+\s*[题問问])/i.test(cleanTitle);

        // 只有在没有编号的情况下添加编号
        if (!hasNumbering) {
            cleanTitle = `${index + 1}. ${cleanTitle}`;
        }

        return cleanTitle;
    }

    // 处理答案文本，清理前缀和格式
    function processAnswer(answerText) {
        if (!answerText) return "";

        let answer = answerText.trim();

        // 移除可能存在的"答案:"、"正确答案:"等前缀
        answer = answer.replace(/^(答案[：:]\s*|正确答案[：:]\s*|解析[：:]\s*)/i, '');

        return answer;
    }

    // 下载Word文档
    function downloadWord(data, filename) {
        if (!data || data.length === 0) {
            updateStatus('没有数据可供下载', 'error');
            setProcessingState(false);
            return;
        }

        try {
            updateStatus("正在创建Word文档...", "active");
            showProgressBar();
            updateProgress(10, "准备生成Word...");

            // 按题型分组
            const groupedData = data.reduce((groups, item) => {
                const type = item['题目类型'];
                if (!groups[type]) {
                    groups[type] = [];
                }
                groups[type].push(item);
                return groups;
            }, {});

            updateProgress(30, "正在格式化内容...");

            // 生成HTML内容 - 使用最简单的格式以确保兼容性
            let htmlContent = `
                <!DOCTYPE html>
                <html xmlns:o="urn:schemas-microsoft-com:office:office"
                      xmlns:w="urn:schemas-microsoft-com:office:word"
                      xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                    <meta charset="utf-8">
                    <title>${filename}</title>
                    <style>
                        body { font-family: SimSun, Arial; line-height: 1.5; }
                        h1 { text-align: center; font-size: 18pt; margin-bottom: 20px; }
                        h2 { margin-top: 24px; background-color: #f0f0f0; padding: 12px; font-size: 14pt; border-radius: 6px; }
                        .question { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
                        .question-text { font-weight: bold; margin-bottom: 15px; line-height: 1.4; }
                        .options { margin-left: 30px; margin-bottom: 15px; }
                        .option-item { margin: 8px 0; }
                        .correct-answer { color: green; background-color: #e8f5e9; padding: 8px 12px; display: inline-block; border-radius: 6px; margin-top: 10px; }
                        .my-answer { color: blue; background-color: #e3f2fd; padding: 8px 12px; display: inline-block; border-radius: 6px; margin-top: 10px; margin-right: 10px; }
                        .mismatch { color: red; background-color: #fdecea; padding: 8px 12px; display: inline-block; border-radius: 6px; margin-top: 10px; }
                        .explanation { margin-top: 15px; padding-top: 15px; border-top: 1px dashed #eee; }
                        .explanation-title { font-weight: bold; margin-bottom: 10px; }
                        .ai-answer { margin-top: 20px; padding: 15px; background-color: #f9f9ff; border-left: 4px solid #4d76ff; border-radius: 6px; }
                        .ai-answer-title { font-weight: bold; margin-bottom: 10px; color: #4d76ff; }
                        img { max-width: 500px; height: auto; border: 1px solid #ddd; padding: 5px; margin: 15px auto; display: block; border-radius: 6px; }
                        .image-caption { text-align: center; color: #666; font-size: 10pt; margin-top: 5px; }
                    </style>
                </head>
                <body>
                    <h1>${filename.replace('.docx', '')}</h1>
            `;

            updateProgress(50, "添加题目内容...");

            // 添加每个题型部分
            Object.keys(groupedData).forEach((type, typeIndex) => {
                const questions = groupedData[type];
                htmlContent += `<h2>${type}</h2>`;

                // 添加每个问题
                questions.forEach((item, index) => {
                    // 处理题目编号，去除可能的重复编号
                    let questionTitle = processQuestionTitle(item['题目'] || "", index);

                    htmlContent += `<div class="question">
                        <div class="question-text">${questionTitle}</div>`;

                    // 添加图片 - 使用简单的img标签
                    if (item['图片'] && Array.isArray(item['图片']) && item['图片'].length > 0) {
                        item['图片'].forEach(img => {
                            if (!img) return;
                            const imgSrc = img.data || img.src;
                            if (!imgSrc) return;
                            const safeAlt = (img.alt || "题目图片").replace(/"/g, "&quot;");

                            // 使用base64或URL，简单嵌入
                            htmlContent += `
                                <div style="text-align:center; margin: 15px 0;">
                                    <img src="${imgSrc}" alt="${safeAlt}" style="max-width:500px; max-height:400px; border: 1px solid #ddd; padding: 5px; border-radius: 6px;" />
                                    <div class="image-caption">${safeAlt}</div>
                                </div>`;
                        });
                    }

                    // 添加选项 - 使用原始格式，不使用自动编号
                    if (item['选项']) {
                        htmlContent += `<div class="options">`;
                        const options = item['选项'].split('\n');
                        options.forEach(option => {
                            if (option.trim()) {
                                htmlContent += `<div class="option-item">${option}</div>`;
                            }
                        });
                        htmlContent += `</div>`;
                    }

                    // 添加答案区域
                    htmlContent += `<div style="display: flex; flex-wrap: wrap; gap: 10px;">`;

                    // 添加我的答案 - 如果未隐藏
                    if (!hideMyAnswers) {
                        const myAnswer = processAnswer(item['我的答案']);
                        htmlContent += `<div class="my-answer">我的答案: ${myAnswer}</div>`;
                    }

                    // 添加正确答案
                    if (item['正确答案']) {
                        const correctAnswer = processAnswer(item['正确答案']);
                        htmlContent += `<div class="correct-answer">正确答案: ${correctAnswer}</div>`;
                    }

                    // 添加答案不匹配指示
                    if (!hideMyAnswers && item['是否正确'] === '✗') {
                        htmlContent += `<div class="mismatch">答案不匹配</div>`;
                    }

                    htmlContent += `</div>`;

                    // 添加题目解析 - 如果启用显示解析并且有解析内容
                    if (showExplanation && item['题目解析'] && item['题目解析'] !== '-') {
                        htmlContent += `
                            <div class="explanation">
                                <div class="explanation-title">题目解析:</div>
                                <div>${item['题目解析']}</div>
                            </div>
                        `;
                    }

                    // 添加AI答案 - 如果有
                    if (item.aiAnswer) {
                        htmlContent += `
                            <div class="ai-answer">
                                <div class="ai-answer-title">AI解答:</div>
                                <div>${formatAnswer(item.aiAnswer)}</div>
                            </div>
                        `;
                    }

                    htmlContent += `</div>`;

                    // 更新进度
                    const progress = 50 + Math.floor((typeIndex / Object.keys(groupedData).length) * 40);
                    updateProgress(progress, `处理第 ${typeIndex + 1}/${Object.keys(groupedData).length} 题型...`);
                });
            });

            htmlContent += `</body></html>`;

            updateProgress(90, "创建下载链接...");

            // 使用Blob API创建文档
            const blob = new Blob([htmlContent], {
                type: 'application/vnd.ms-word;charset=utf-8'
            });

            // 创建下载链接并触发下载
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            updateProgress(100, "完成!");
            setTimeout(() => {
                hideProgressBar();
                updateStatus(`Word文档已成功生成并下载: ${filename}`, "success");
                setProcessingState(false);

                // 添加动画反馈
                if (animationsEnabled) {
                    showToast(`Word文档已成功生成: ${filename}`, "success");
                }
            }, 1000);

        } catch (error) {
            console.error("下载Word文档失败:", error);
            hideProgressBar();
            updateStatus(`下载Word文档失败: ${error.message}`, "error");
            setProcessingState(false);

            // 添加错误反馈
            if (animationsEnabled) {
                showToast(`下载Word文档失败: ${error.message}`, "error");
            }
        }
    }

    // 下载PDF
    function downloadPDF(data, filename) {
        if (!data || data.length === 0) {
            updateStatus('没有数据可供下载', 'error');
            setProcessingState(false);
            return;
        }

        try {
            updateStatus("正在创建PDF文件...", "active");
            // 显示进度条
            showProgressBar();
            updateProgress(0, '准备生成PDF...');

            // 检查jsPDF是否可用
            if (typeof jspdf === 'undefined') {
                hideProgressBar();
                updateStatus("错误: jsPDF库未加载，请检查脚本设置中的 @require", "error");
                setProcessingState(false);

                // 错误反馈
                if (animationsEnabled) {
                    showToast("错误: jsPDF库未加载", "error");
                }
                return;
            }

            // 创建一个临时容器来渲染内容
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'fixed';
            tempContainer.style.top = '-9999px';
            tempContainer.style.left = '-9999px';
            tempContainer.style.width = '800px'; // 固定宽度以便于转换
            tempContainer.style.fontFamily = 'SimSun, Arial';
            document.body.appendChild(tempContainer);

            // 按题型分组
            const groupedData = data.reduce((groups, item) => {
                const type = item['题目类型'];
                if (!groups[type]) {
                    groups[type] = [];
                }
                groups[type].push(item);
                return groups;
            }, {});

            // 生成HTML内容
            updateProgress(5, '生成HTML内容...');

            // 使用自定义标题或默认标题
            const docTitle = customTitle || filename.replace('.pdf', '');

            let htmlContent = `
                <div style="padding: 20px; font-family: SimSun, Arial;">
                    <h1 style="text-align: center; font-size: 18pt; margin-bottom: 20px;">${docTitle}</h1>
            `;

            // 添加每个题型部分
            Object.keys(groupedData).forEach(type => {
                const questions = groupedData[type];
                htmlContent += `<h2 style="margin-top: 24px; background-color: #f0f0f0; padding: 12px; font-size: 14pt; border-radius: 6px;">${type}</h2>`;

                // 添加每个问题
                questions.forEach((item, index) => {
                    let questionTitle = processQuestionTitle(item['题目'] || "", index);

                    htmlContent += `<div style="margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 20px;">
                        <div style="font-weight: bold; margin-bottom: 15px; line-height: 1.4;">${questionTitle}</div>`;

                    // 图片需要处理为base64格式才能嵌入PDF
                    if (item['图片'] && Array.isArray(item['图片']) && item['图片'].length > 0) {
                        item['图片'].forEach(img => {
                            if (!img) return;
                            const imgSrc = img.data || img.src;
                            if (!imgSrc) return;
                            const safeAlt = (img.alt || "题目图片").replace(/"/g, "&quot;");

                            htmlContent += `<div style="text-align:center; margin: 15px 0;">
                                <img src="${imgSrc}" alt="${safeAlt}" style="max-width:500px; max-height:400px; border: 1px solid #ddd; padding: 5px; border-radius: 6px;" />
                                <div style="font-size:10pt; color:#666; margin-top: 5px;">${safeAlt}</div>
                            </div>`;
                        });
                    }

                    // 添加选项
                    if (item['选项']) {
                        htmlContent += `<div style="margin-left: 30px; margin-bottom: 15px;">`;
                        const options = item['选项'].split('\n');
                        options.forEach(option => {
                            if (option.trim()) {
                                htmlContent += `<div style="margin: 8px 0;">${option}</div>`;
                            }
                        });
                        htmlContent += `</div>`;
                    }

                    // 添加答案区域
                    htmlContent += `<div style="display: flex; flex-wrap: wrap; gap: 10px;">`;

                    // 添加我的答案
                    if (!hideMyAnswers) {
                        const myAnswer = processAnswer(item['我的答案']);
                        htmlContent += `<div style="color: blue; background-color: #e3f2fd; padding: 8px 12px; display: inline-block; border-radius: 6px; margin-top: 10px;">我的答案: ${myAnswer}</div>`;
                    }

                    // 添加正确答案
                    if (item['正确答案']) {
                        const correctAnswer = processAnswer(item['正确答案']);
                        htmlContent += `<div style="color: green; background-color: #e8f5e9; padding: 8px 12px; display: inline-block; border-radius: 6px; margin-top: 10px;">正确答案: ${correctAnswer}</div>`;
                    }

                    // 添加答案不匹配指示
                    if (!hideMyAnswers && item['是否正确'] === '✗') {
                        htmlContent += `<div style="color: red; background-color: #fdecea; padding: 8px 12px; display: inline-block; border-radius: 6px; margin-top: 10px;">答案不匹配</div>`;
                    }

                    htmlContent += `</div>`;

                    // 添加解析
                    if (showExplanation && item['题目解析'] && item['题目解析'] !== '-') {
                        htmlContent += `
                            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #eee;">
                                <div style="font-weight: bold; margin-bottom: 10px;">题目解析:</div>
                                <div style="color: #333;">${item['题目解析']}</div>
                            </div>
                        `;
                    }

                    // 添加AI解答 - 如果有
                    if (item.aiAnswer) {
                        htmlContent += `
                            <div style="margin-top: 20px; padding: 15px; background-color: #f9f9ff; border-left: 4px solid #4d76ff; border-radius: 6px;">
                                <div style="font-weight: bold; margin-bottom: 10px; color: #4d76ff;">AI解答:</div>
                                <div style="color: #333;">${formatAnswer(item.aiAnswer)}</div>
                            </div>
                        `;
                    }

                    htmlContent += `</div>`;
                });
            });

            htmlContent += `</div>`;

            // 设置临时容器的内容
            tempContainer.innerHTML = htmlContent;
            updateProgress(10, '解析内容结构...');

            // 计算总数 - 用于进度条
            const totalElements = tempContainer.querySelectorAll('h2, div[style*="margin-bottom: 25px"]').length;
            let processedElements = 0;

            // 分页处理函数
            const processPages = async () => {
                updateProgress(15, '创建PDF...');
                // 创建PDF实例
                const { jsPDF } = jspdf;
                const pdf = new jsPDF('p', 'pt', 'a4');
                const pageWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();

                // 设置文档属性
                pdf.setProperties({
                    title: customTitle || filename.replace('.pdf', ''),
                    subject: '题目解析',
                    author: '题目解析工具',
                    keywords: '题目,答案,解析',
                    creator: '题目解析工具'
                });

                // 暂时计算每页的合理高度（实际用canvas高度决定）
                const elementsToRender = tempContainer.querySelectorAll('h2, div[style*="margin-bottom: 25px"]');
                let currentY = 40; // 页面顶部边距
                let pageIndex = 0;

                // 依次处理每个区块（题型标题或题目）
                for (let i = 0; i < elementsToRender.length; i++) {
                    const element = elementsToRender[i];

                    // 计算当前进度
                    processedElements++;
                    const progressPercent = 15 + Math.floor((processedElements / totalElements) * 80);
                    updateProgress(progressPercent, `渲染第 ${processedElements}/${totalElements} 个元素...`);

                    // 创建区块的副本进行单独处理
                    const tempElement = document.createElement('div');
                    tempElement.style.position = 'absolute';
                    tempElement.style.top = '0';
                    tempElement.style.left = '0';
                    tempElement.style.width = '800px';
                    tempElement.innerHTML = element.outerHTML;
                    document.body.appendChild(tempElement);

                    // 使用html2canvas捕获区块
                    try {
                        const canvas = await html2canvas(tempElement, {
                            scale: 1.5, // 提高清晰度
                            useCORS: true, // 处理跨域图片
                            logging: false,
                            allowTaint: true
                        });

                        // 计算缩放比例，使其适合PDF页面宽度
                        const imgWidth = pageWidth - 40; // 页面边距
                        const imgHeight = (canvas.height * imgWidth) / canvas.width;

                        // 检查是否需要新页面
                        if (currentY + imgHeight > pageHeight - 40) {
                            if (pageIndex > 0) {
                                pdf.addPage();
                            }
                            pageIndex++;
                            currentY = 40; // 重置到新页面顶部
                            updateProgress(progressPercent, `添加第 ${pageIndex} 页...`);
                        }

                        // 将canvas转换为图片并添加到PDF
                        const imgData = canvas.toDataURL('image/jpeg', 0.95);
                        pdf.addImage(imgData, 'JPEG', 20, currentY, imgWidth, imgHeight);
                        currentY += imgHeight + 20; // 添加一些间距

                        // 添加页码 - 在当前页的底部（使用数字避免中文乱码）
                        const currentPage = pageIndex + 1;
                        pdf.setFontSize(10);
                        pdf.setTextColor(100, 100, 100);
                        pdf.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

                        // 清理临时元素
                        document.body.removeChild(tempElement);
                    } catch (e) {
                        console.error("渲染题目内容失败:", e);
                        // 继续处理下一个元素
                        document.body.removeChild(tempElement);
                    }
                }

                // 更新进度并准备保存
                updateProgress(95, '完成 PDF 生成...');

                // 添加最后一页的页码（如果尚未添加）
                const totalPages = pageIndex + 1;
                pdf.setFontSize(10);
                pdf.setTextColor(100, 100, 100);
                pdf.text(`Page ${totalPages}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

                // 保存PDF
                pdf.save(filename);

                // 清理临时容器
                document.body.removeChild(tempContainer);
                updateStatus(`PDF文件已成功生成并下载 (共 ${totalPages} 页)`, "success");

                // 动画反馈
                if (animationsEnabled) {
                    showToast(`PDF文件已成功生成 (共 ${totalPages} 页)`, "success");
                }

                // 完成 - 100%
                updateProgress(100, '完成！');
                setTimeout(() => {
                    hideProgressBar();
                    setProcessingState(false);
                }, 1500); // 1.5秒后隐藏进度条
            };

            // 执行分页处理
            processPages().catch(error => {
                console.error("生成PDF失败:", error);
                document.body.removeChild(tempContainer);
                updateStatus(`生成PDF失败: ${error.message}`, "error");
                updateProgress(0, '出错了！');

                // 错误反馈
                if (animationsEnabled) {
                    showToast(`生成PDF失败: ${error.message}`, "error");
                }

                setTimeout(() => {
                    hideProgressBar();
                    setProcessingState(false);
                }, 1500);
            });

        } catch (error) {
            console.error("下载PDF失败:", error);
            updateStatus(`下载PDF失败: ${error.message}`, "error");
            hideProgressBar();
            setProcessingState(false);

            // 添加错误反馈
            if (animationsEnabled) {
                showToast(`下载PDF失败: ${error.message}`, "error");
            }
        }
    }

    // ===== AI答题功能 =====
    // 设置AI解答按钮事件监听
    function setupAIAnswerListeners() {
        // 所有AI解答按钮
        document.querySelectorAll(`.${AI_TOOL_ID}_btn`).forEach(button => {
            button.addEventListener('click', function() {
                const questionId = this.dataset.questionId;
                toggleAnswer(questionId, this);
            });
        });

        // AI设置按钮
        document.querySelectorAll(`.${AI_TOOL_ID}_config_btn`).forEach(button => {
            button.addEventListener('click', function(e) {
                e.stopPropagation();
                openAISettingsModal();
            });
        });
    }

    // 切换显示/隐藏答案，或请求新答案
    function toggleAnswer(questionId, button) {
        const answerContainer = document.getElementById(`${AI_ANSWER_ID}_${questionId}`);

        if (!answerContainer) {
            console.error(`找不到答案容器: ${AI_ANSWER_ID}_${questionId}`);
            return;
        }

        // 如果答案容器已有内容且正在显示，则隐藏
        if (answerContainer.innerHTML !== '' && answerContainer.style.display !== 'none') {
            if (animationsEnabled) {
                // 添加隐藏动画
                const answerElement = answerContainer.querySelector(`.${AI_TOOL_ID}_answer_container`);
                if (answerElement) {
                    answerElement.style.opacity = '0';
                    answerElement.style.transform = 'translateY(10px)';

                    setTimeout(() => {
                        answerContainer.style.display = 'none';
                    }, 300);
                } else {
                    answerContainer.style.display = 'none';
                }
            } else {
                answerContainer.style.display = 'none';
            }
            button.innerHTML = `<span style="margin-right: 6px;">🤖</span>AI解答`;
            return;
        }

        // 显示答案容器
        answerContainer.style.display = 'block';

        // 如果已有答案内容，直接显示
        if (answerContainer.innerHTML !== '') {
            button.innerHTML = `<span style="margin-right: 6px;">🤖</span>隐藏解答`;

            // 如果有动画，添加显示动画到已存在的答案
            if (animationsEnabled) {
                const answerElement = answerContainer.querySelector(`.${AI_TOOL_ID}_answer_container`);
                if (answerElement) {
                    answerElement.style.opacity = '0';
                    answerElement.style.transform = 'translateY(10px)';

                    setTimeout(() => {
                        answerElement.style.opacity = '1';
                        answerElement.style.transform = 'translateY(0)';
                    }, 10);
                }
            }
            return;
        }

        // 否则请求新答案
        button.disabled = true;
        button.innerHTML = `<span class="${AI_TOOL_ID}_loading"></span>生成中...`;
        isAnswering = true;

        // 创建临时答案容器
        const tempAnswer = document.createElement('div');
        tempAnswer.className = `${AI_TOOL_ID}_answer_container`;
        tempAnswer.innerHTML = `
            <div class="${AI_TOOL_ID}_answer_header">
                <div>AI解答中...</div>
            </div>
            <div class="${AI_TOOL_ID}_answer_content">正在思考问题，请稍候...</div>
        `;
        answerContainer.appendChild(tempAnswer);

        // 生成提示词
        const prompt = generatePrompt(questionId);

        // 请求AI答案
        requestAIAnswer(prompt, questionId)
            .then(answer => {
                if (answer) {
                    showAnswer(questionId, answer, button);
                } else {
                    showAnswerError(questionId, "获取回答失败，请检查API设置并重试。", button);
                }
            })
            .catch(error => {
                console.error("AI答案请求失败:", error);
                showAnswerError(questionId, "API请求错误: " + error.message, button);
            })
            .finally(() => {
                button.disabled = false;
                button.innerHTML = `<span style="margin-right: 6px;">🤖</span>隐藏解答`;
                isAnswering = false;
            });
    }

    // 生成完整提示词
    function generatePrompt(questionId) {
        const question = activeQuestions[questionId];

        if (!question) return '';

        // 根据题目内容选择合适的提示词模板
        let promptTemplate = aiSettings.defaultPrompt;

        // 简单的题目分类判断
        if (question.questionText.match(/[\d+\-*/^=()]+/) || question.questionText.includes('解方程') ||
            question.questionText.includes('计算') || question.questionText.includes('求值')) {
            promptTemplate = aiSettings.customPrompts.math;
        } else if (question.questionText.match(/[a-zA-Z]{3,}/) || question.questionText.includes('translate') ||
                  question.questionText.includes('英语') || question.options.some(opt => opt.match(/[a-zA-Z]{5,}/))) {
            promptTemplate = aiSettings.customPrompts.english;
        } else if (question.questionText.includes('化学') || question.questionText.includes('物理') ||
                  question.questionText.includes('生物') || question.questionText.includes('分子')) {
            promptTemplate = aiSettings.customPrompts.science;
        }

        // 构建完整提示词
        let fullPrompt = promptTemplate + '\n\n';
        fullPrompt += '题目：' + question.questionText + '\n\n';

        if (question.options && question.options.length > 0) {
            fullPrompt += '选项：\n';
            question.options.forEach((option, i) => {
                fullPrompt += option + '\n';
            });
            fullPrompt += '\n';
        }

        if (question.correctAnswer) {
            fullPrompt += '正确答案：' + question.correctAnswer + '\n\n';
        }

        fullPrompt += '请提供详细解答，包括思路分析和结论。';

        return fullPrompt;
    }

    // 显示答案
    function showAnswer(questionId, answer, button) {
        const answerContainer = document.getElementById(`${AI_ANSWER_ID}_${questionId}`);
        if (!answerContainer) return;

        // 清空容器
        answerContainer.innerHTML = '';

        // 创建答案显示
        const answerElement = document.createElement('div');
        answerElement.className = `${AI_TOOL_ID}_answer_container`;

        const apiName = getAPIName(aiSettings.apiType);

        answerElement.innerHTML = `
            <div class="${AI_TOOL_ID}_answer_header">
                <div>${apiName} 解答</div>
            </div>
            <div class="${AI_TOOL_ID}_answer_content">${formatAnswer(answer)}</div>
            <div class="${AI_TOOL_ID}_answer_actions">
                <button class="${AI_TOOL_ID}_action_btn" data-action="copy">
                    <span class="${AI_TOOL_ID}_action_icon">📋</span>复制
                </button>
                <button class="${AI_TOOL_ID}_action_btn" data-action="regenerate">
                    <span class="${AI_TOOL_ID}_action_icon">🔄</span>重新生成
                </button>
            </div>
        `;

        answerContainer.appendChild(answerElement);

        // 存储AI答案到问题数据结构中
        if (activeQuestions[questionId]) {
            activeQuestions[questionId].aiAnswer = answer;
        }

        // 在原始问题中也添加AI答案
        for (let section of allQsObject) {
            for (let question of section.nodeList) {
                if (question.id === questionId) {
                    question.aiAnswer = answer;
                    break;
                }
            }
        }

        // 添加动作按钮事件
        const copyBtn = answerElement.querySelector(`[data-action="copy"]`);
        const regenerateBtn = answerElement.querySelector(`[data-action="regenerate"]`);

        copyBtn.addEventListener('click', () => {
            const textToCopy = answer.trim();
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.innerHTML = `<span class="${AI_TOOL_ID}_action_icon">✅</span>已复制`;

                // 添加动画反馈
                if (animationsEnabled) {
                    showToast("已复制到剪贴板", "success");
                }

                setTimeout(() => {
                    copyBtn.innerHTML = `<span class="${AI_TOOL_ID}_action_icon">📋</span>复制`;
                }, 2000);
            });
        });

        regenerateBtn.addEventListener('click', () => {
            // 清空答案容器
            answerContainer.innerHTML = '';

            // 重新请求答案
            button.disabled = true;
            button.innerHTML = `<span class="${AI_TOOL_ID}_loading"></span>重新生成...`;
            isAnswering = true;

            // 创建临时答案容器
            const tempAnswer = document.createElement('div');
            tempAnswer.className = `${AI_TOOL_ID}_answer_container`;
            tempAnswer.innerHTML = `<div class="${AI_TOOL_ID}_answer_header">
                    <div>重新生成中...</div>
                </div>
                <div class="${AI_TOOL_ID}_answer_content">正在思考问题，请稍候...</div>
            `;
            answerContainer.appendChild(tempAnswer);

            // 生成提示词并添加变化以获得不同回答
            const prompt = generatePrompt(questionId) + '\n请提供与之前不同的解答方法和角度。';

            // 请求AI答案
            requestAIAnswer(prompt, questionId)
                .then(newAnswer => {
                    if (newAnswer) {
                        showAnswer(questionId, newAnswer, button);

                        // 添加动画反馈
                        if (animationsEnabled) {
                            showToast("已重新生成答案", "success");
                        }
                    } else {
                        showAnswerError(questionId, "重新生成失败，请检查API设置并重试。", button);
                    }
                })
                .catch(error => {
                    console.error("重新生成失败:", error);
                    showAnswerError(questionId, "API请求错误: " + error.message, button);
                })
                .finally(() => {
                    button.disabled = false;
                    button.innerHTML = `<span style="margin-right: 6px;">🤖</span>隐藏解答`;
                    isAnswering = false;
                });
        });
    }

    // 显示答案错误
    function showAnswerError(questionId, errorMessage, button) {
        const answerContainer = document.getElementById(`${AI_ANSWER_ID}_${questionId}`);
        if (!answerContainer) return;

        // 清空容器
        answerContainer.innerHTML = '';

        // 创建错误显示
        const errorElement = document.createElement('div');
        errorElement.className = `${AI_TOOL_ID}_answer_container`;
        errorElement.style.borderLeftColor = '#f44336';

        errorElement.innerHTML = `
            <div class="${AI_TOOL_ID}_answer_header">
                <div>错误</div>
            </div>
            <div class="${AI_TOOL_ID}_answer_content" style="color: #f44336;">${errorMessage}</div>
            <div class="${AI_TOOL_ID}_answer_actions">
                <button class="${AI_TOOL_ID}_action_btn" data-action="retry">
                    <span class="${AI_TOOL_ID}_action_icon">🔄</span>重试
                </button>
                <button class="${AI_TOOL_ID}_action_btn" data-action="settings">
                    <span class="${AI_TOOL_ID}_action_icon">⚙️</span>设置
                </button>
            </div>
        `;

        answerContainer.appendChild(errorElement);

        // 添加错误反馈
        if (animationsEnabled) {
            errorElement.style.animation = `${TOOL_ID}_shake 0.5s`;
            showToast(errorMessage, "error");
        }

        // 添加动作按钮事件
        const retryBtn = errorElement.querySelector(`[data-action="retry"]`);
        const settingsBtn = errorElement.querySelector(`[data-action="settings"]`);

        retryBtn.addEventListener('click', () => {
            // 清空答案容器
            answerContainer.innerHTML = '';

            // 触发按钮点击以重新请求
            button.click();
        });

        settingsBtn.addEventListener('click', () => {
            openAISettingsModal();
        });
    }

    // 格式化答案，处理换行和Markdown
    function formatAnswer(answer) {
        if (!answer) return '';

        // 处理基本的Markdown元素
        let formattedAnswer = answer
            // 转义HTML
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // 处理换行
            .replace(/\n/g, '<br>')
            // 处理粗体
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // 处理斜体
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // 处理代码
            .replace(/`(.*?)`/g, '<code style="background-color: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px;">$1</code>');

        return formattedAnswer;
    }

    // 获取API名称
    function getAPIName(apiType) {
        switch (apiType) {
            case 'deepseek': return 'DeepSeek';
            case 'openai': return 'OpenAI';
            case 'gemini': return 'Gemini';
            case 'anthropic': return 'Claude';
            default: return 'AI';
        }
    }

    // 请求AI答案 - 支持多种API
    function requestAIAnswer(prompt, questionId) {
        return new Promise((resolve, reject) => {
            if (!aiSettings.apiKey) {
                reject(new Error('未设置API密钥'));
                return;
            }

            let apiUrl, requestData, headers;

            // 根据不同API配置请求
            switch (aiSettings.apiType) {
                case 'deepseek':
                    apiUrl = 'https://api.deepseek.com/v1/chat/completions';
                    requestData = {
                        model: "deepseek-chat",
                        messages: [{ role: "user", content: prompt }],
                        temperature: parseFloat(aiSettings.temperature) || 0.7
                    };
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${aiSettings.apiKey}`
                    };
                    break;

                case 'openai':
                    apiUrl = 'https://api.openai.com/v1/chat/completions';
                    requestData = {
                        model: "gpt-3.5-turbo",
                        messages: [{ role: "user", content: prompt }],
                        temperature: parseFloat(aiSettings.temperature) || 0.7
                    };
                    headers = {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${aiSettings.apiKey}`
                    };
                    break;

                case 'gemini':
                    apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
                    requestData = {
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: parseFloat(aiSettings.temperature) || 0.7
                        }
                    };
                    // 添加API密钥作为URL参数
                    apiUrl += `?key=${aiSettings.apiKey}`;
                    headers = {
                        'Content-Type': 'application/json'
                    };
                    break;

                case 'anthropic':
                    apiUrl = 'https://api.anthropic.com/v1/messages';
                    requestData = {
                        model: "claude-3-haiku-20240307",
                        messages: [{ role: "user", content: prompt }],
                        max_tokens: 4000,
                        temperature: parseFloat(aiSettings.temperature) || 0.7
                    };
                    headers = {
                        'Content-Type': 'application/json',
                        'x-api-key': aiSettings.apiKey,
                        'anthropic-version': '2023-06-01'
                    };
                    break;

                default:
                    reject(new Error('不支持的API类型'));
                    return;
            }

            // 发送API请求
            GM_xmlhttpRequest({
                method: 'POST',
                url: apiUrl,
                headers: headers,
                data: JSON.stringify(requestData),
                responseType: 'json',
                onload: function(response) {
                    if (response.status >= 200 && response.status < 300) {
                        try {
                            let answer = '';

                            // 根据不同API解析响应
                            switch (aiSettings.apiType) {
                                case 'deepseek':
                                case 'openai':
                                    answer = response.response.choices[0].message.content;
                                    break;

                                case 'gemini':
                                    answer = response.response.candidates[0].content.parts[0].text;
                                    break;

                                case 'anthropic':
                                    answer = response.response.content[0].text;
                                    break;
                            }

                            resolve(answer);
                        } catch (e) {
                            console.error('解析API响应失败:', e, response);
                            reject(new Error('解析响应失败: ' + e.message));
                        }
                    } else {
                        console.error('API响应错误:', response);

                        // 尝试解析错误信息
                        let errorMsg = '请求失败，状态码: ' + response.status;
                        try {
                            if (response.response && response.response.error) {
                                errorMsg = response.response.error.message || errorMsg;
                            }
                        } catch (e) {}

                        reject(new Error(errorMsg));
                    }
                },
                onerror: function(error) {
                    console.error('请求出错:', error);
                    reject(new Error('网络请求失败'));
                },
                ontimeout: function() {
                    reject(new Error('请求超时'));
                }
            });
        });
    }

    // 打开AI设置模态框
    function openAISettingsModal() {
        // 检查是否已存在
        let modal = document.getElementById(`${AI_TOOL_ID}_settings_modal`);

        if (!modal) {
            modal = document.createElement('div');
            modal.id = `${AI_TOOL_ID}_settings_modal`;
            modal.className = `${TOOL_ID}_modal`;

            modal.innerHTML = `
                <div class="${TOOL_ID}_modal_content">
                    <div class="${TOOL_ID}_modal_header">
                        <div class="${TOOL_ID}_modal_title">AI解答设置</div>
                        <button class="${TOOL_ID}_modal_close">&times;</button>
                    </div>

                    <div class="${TOOL_ID}_tabs">
                        <button class="${TOOL_ID}_tab active" data-tab="api">API设置</button>
                        <button class="${TOOL_ID}_tab" data-tab="prompt">提示词设置</button>
                        <div class="${TOOL_ID}_tab_slider"></div>
                    </div>

                    <!-- API设置面板 -->
                    <div class="${TOOL_ID}_tab_content active" data-tab-content="api">
                        <div class="${TOOL_ID}_form_group">
                            <label class="${TOOL_ID}_label">选择API</label>
                            <select class="${TOOL_ID}_select" id="${AI_TOOL_ID}_api_type">
                                <option value="deepseek" ${aiSettings.apiType === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                                <option value="openai" ${aiSettings.apiType === 'openai' ? 'selected' : ''}>OpenAI</option>
                                <option value="gemini" ${aiSettings.apiType === 'gemini' ? 'selected' : ''}>Google Gemini</option>
                                <option value="anthropic" ${aiSettings.apiType === 'anthropic' ? 'selected' : ''}>Anthropic Claude</option>
                            </select>
                        </div>

                        <div class="${TOOL_ID}_form_group">
                            <label class="${TOOL_ID}_label">API密钥</label>
                            <input type="password" class="${TOOL_ID}_input" id="${AI_TOOL_ID}_api_key" value="${aiSettings.apiKey}" placeholder="输入您的API密钥">
                        </div>

                        <div class="${TOOL_ID}_form_group">
                            <label class="${TOOL_ID}_label">温度 (0.0-1.0)</label>
                            <input type="range" class="${TOOL_ID}_input" id="${AI_TOOL_ID}_temperature" min="0" max="1" step="0.1" value="${aiSettings.temperature}">
                            <div style="display: flex; justify-content: space-between; margin-top: 5px;">
                                <span>精确</span>
                                <span id="${AI_TOOL_ID}_temp_value">${aiSettings.temperature}</span>
                                <span>创意</span>
                            </div>
                        </div>
                    </div>

                    <!-- 提示词设置面板 -->
                    <div class="${TOOL_ID}_tab_content" data-tab-content="prompt">
                        <div class="${TOOL_ID}_form_group">
                            <label class="${TOOL_ID}_label">默认提示词</label>
                            <textarea class="${TOOL_ID}_textarea" id="${AI_TOOL_ID}_default_prompt" placeholder="输入默认提示词模板">${aiSettings.defaultPrompt}</textarea>
                        </div>

                        <div class="${TOOL_ID}_form_group">
                            <label class="${TOOL_ID}_label">数学题提示词</label>
                            <textarea class="${TOOL_ID}_textarea" id="${AI_TOOL_ID}_math_prompt" placeholder="输入数学题提示词模板">${aiSettings.customPrompts.math}</textarea>
                        </div>

                        <div class="${TOOL_ID}_form_group">
                            <label class="${TOOL_ID}_label">英语题提示词</label>
                            <textarea class="${TOOL_ID}_textarea" id="${AI_TOOL_ID}_english_prompt" placeholder="输入英语题提示词模板">${aiSettings.customPrompts.english}</textarea>
                        </div>

                        <div class="${TOOL_ID}_form_group">
                            <label class="${TOOL_ID}_label">科学题提示词</label>
                            <textarea class="${TOOL_ID}_textarea" id="${AI_TOOL_ID}_science_prompt" placeholder="输入科学题提示词模板">${aiSettings.customPrompts.science}</textarea>
                        </div>
                    </div>

                    <div class="${TOOL_ID}_modal_footer">
                        <button class="${TOOL_ID}_btn" id="${AI_TOOL_ID}_cancel_btn" style="background: rgba(0,0,0,0.1); color: #555;">取消</button>
                        <button class="${TOOL_ID}_btn" id="${AI_TOOL_ID}_save_btn">保存设置</button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // 初始化滑块位置
            setTimeout(() => {
                updateAITabSlider();
            }, 10);

            // 添加事件监听器
            document.getElementById(`${AI_TOOL_ID}_temp_value`).textContent = aiSettings.temperature;
            document.getElementById(`${AI_TOOL_ID}_temperature`).addEventListener('input', function() {
                document.getElementById(`${AI_TOOL_ID}_temp_value`).textContent = this.value;
            });

            // 标签切换
            document.querySelectorAll(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_tab`).forEach(tab => {
                tab.addEventListener('click', function() {
                    // 移除所有活动标签
                    document.querySelectorAll(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_tab`).forEach(t => t.classList.remove('active'));
                    document.querySelectorAll(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_tab_content`).forEach(c => c.classList.remove('active'));

                    // 添加活动状态到当前标签
                    this.classList.add('active');
                    document.querySelector(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_tab_content[data-tab-content="${this.dataset.tab}"]`).classList.add('active');

                    // 更新滑块位置
                    updateAITabSlider();
                });
            });

            // 关闭按钮
            document.querySelector(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_modal_close`).addEventListener('click', function() {
                closeAISettingsModal();
            });

            // 取消按钮
            document.getElementById(`${AI_TOOL_ID}_cancel_btn`).addEventListener('click', function() {
                closeAISettingsModal();
            });

            // 保存按钮
            document.getElementById(`${AI_TOOL_ID}_save_btn`).addEventListener('click', function() {
                saveAISettingsFromModal();
                closeAISettingsModal();
            });

            // 应用暗色模式
            if (darkMode) {
                document.querySelector(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_modal_content`).classList.add('dark-mode');
            }
        }

        // 显示模态框
        modal.classList.add('active');
    }

    // 更新AI设置选项卡滑块位置
    function updateAITabSlider() {
        const activeTab = document.querySelector(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_tab.active`);
        const slider = document.querySelector(`#${AI_TOOL_ID}_settings_modal .${TOOL_ID}_tab_slider`);

        if (activeTab && slider) {
            slider.style.width = `${activeTab.offsetWidth}px`;
            slider.style.left = `${activeTab.offsetLeft}px`;
        }
    }

    // 关闭AI设置模态框
    function closeAISettingsModal() {
        const modal = document.getElementById(`${AI_TOOL_ID}_settings_modal`);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    // 从模态框保存AI设置
    function saveAISettingsFromModal() {
        aiSettings = {
            apiType: document.getElementById(`${AI_TOOL_ID}_api_type`).value,
            apiKey: document.getElementById(`${AI_TOOL_ID}_api_key`).value,
            temperature: document.getElementById(`${AI_TOOL_ID}_temperature`).value,
            defaultPrompt: document.getElementById(`${AI_TOOL_ID}_default_prompt`).value,
            customPrompts: {
                math: document.getElementById(`${AI_TOOL_ID}_math_prompt`).value,
                english: document.getElementById(`${AI_TOOL_ID}_english_prompt`).value,
                science: document.getElementById(`${AI_TOOL_ID}_science_prompt`).value
            },
            showInToolbox: true
        };

        saveSettings();
        showToast("AI设置已保存", "success");
    }

    // ===== 预览功能 =====
    // 创建预览模态框
    function createPreviewModal() {
        // 检查模态框是否已存在
        if (document.getElementById(`${TOOL_ID}_preview_modal`)) {
            return;
        }

        const modal = document.createElement('div');
        modal.id = `${TOOL_ID}_preview_modal`;
        modal.className = `${TOOL_ID}_modal`;

        modal.innerHTML = `
            <div class="${TOOL_ID}_modal_content">
                <div class="${TOOL_ID}_modal_header">
                    <div class="${TOOL_ID}_modal_title">导出预览</div>
                    <button class="${TOOL_ID}_modal_close">×</button>
                </div>
                <div class="${TOOL_ID}_modal_body" id="${TOOL_ID}_preview_content"></div>
                <div class="${TOOL_ID}_modal_footer">
                    <div id="${TOOL_ID}_format_selector" style="display: flex; gap: 10px;">
                        <button class="${TOOL_ID}_btn" data-format="excel" style="background: linear-gradient(135deg, #4285f4, #0F9D58); min-width: 120px;">Excel预览</button>
                        <button class="${TOOL_ID}_btn" data-format="word" style="background: linear-gradient(135deg, #0F9D58, #34A853); min-width: 120px;">Word预览</button>
                        <button class="${TOOL_ID}_btn" data-format="pdf" style="background: linear-gradient(135deg, #DB4437, #F4B400); min-width: 120px;">PDF预览</button>
                    </div>
                    <div>
                        <button id="${TOOL_ID}_download_btn" class="${TOOL_ID}_btn">
                            <span class="${TOOL_ID}_btn_icon">💾</span>下载文件
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // 添加模态框事件监听器
        document.getElementById(`${TOOL_ID}_preview_modal`).querySelector(`.${TOOL_ID}_modal_close`).addEventListener('click', closePreviewModal);

        // 添加格式选择按钮事件监听器
        document.querySelectorAll(`#${TOOL_ID}_format_selector .${TOOL_ID}_btn`).forEach(btn => {
            btn.addEventListener('click', function() {
                // 移除所有按钮的激活样式
                document.querySelectorAll(`#${TOOL_ID}_format_selector .${TOOL_ID}_btn`).forEach(b => {
                    b.style.opacity = '0.7';
                    b.style.transform = 'none';
                });
                // 添加激活样式到当前点击的按钮
                this.style.opacity = '1';

                if (animationsEnabled) {
                    this.style.transform = 'translateY(-5px)';
                    this.style.boxShadow = '0 8px 15px rgba(0,0,0,0.2)';
                }

                // 根据选择的格式更新预览内容
                generatePreview(this.dataset.format);
            });
        });

        // 添加下载按钮事件监听器
        document.getElementById(`${TOOL_ID}_download_btn`).addEventListener('click', function() {
            // 获取当前激活的格式
            const activeBtn = document.querySelector(`#${TOOL_ID}_format_selector .${TOOL_ID}_btn[style*="opacity: 1"]`);
            if (!activeBtn) return;

            const activeFormat = activeBtn.dataset.format;

            // 关闭模态框
            closePreviewModal();

            // 触发对应的下载按钮点击
            document.getElementById(`${BOX_ID}_${activeFormat}_btn`).click();
        });
    }

    // 打开预览模态框
    function openPreviewModal() {
        // 确保模态框已创建
        createPreviewModal();

        // 应用暗色模式（如果启用）
        if (darkMode) {
            document.querySelector(`#${TOOL_ID}_preview_modal .${TOOL_ID}_modal_content`).classList.add('dark-mode');
        } else {
            document.querySelector(`#${TOOL_ID}_preview_modal .${TOOL_ID}_modal_content`).classList.remove('dark-mode');
        }

        // 显示模态框
        const modal = document.getElementById(`${TOOL_ID}_preview_modal`);
        modal.classList.add('active');

        // 默认选中Excel格式并生成预览
        const excelBtn = document.querySelector(`#${TOOL_ID}_format_selector .${TOOL_ID}_btn[data-format="excel"]`);
        excelBtn.click();

        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }

    // 关闭预览模态框
    function closePreviewModal() {
        const modal = document.getElementById(`${TOOL_ID}_preview_modal`);
        if (modal) {
            modal.classList.remove('active');

            // 恢复背景滚动
            document.body.style.overflow = '';
        }
    }

    // 根据选择的格式生成预览内容
    function generatePreview(format) {
        if (isProcessing) return;

        const previewContent = document.getElementById(`${TOOL_ID}_preview_content`);
        if (!previewContent) return;

        // 清空之前的内容并显示加载动画
        previewContent.innerHTML = `
            <div style="text-align: center; padding: 60px;">
                <div class="${TOOL_ID}_loading" style="width: 40px; height: 40px; margin: 0 auto 20px; border-width: 4px;"></div>
                <div style="color: ${darkMode ? '#aaa' : '#888'}; font-size: 16px;">正在生成预览...</div>
            </div>
        `;

        // 获取导出数据
        const exportData = prepareExportData();
        if (!exportData || !exportData.data || exportData.data.length === 0) {
            previewContent.innerHTML = `
                <div style="text-align: center; padding: 60px; color: ${darkMode ? '#aaa' : '#888'};">
                    <div style="font-size: 48px; margin-bottom: 20px;">📝</div>
                    <div style="font-size: 18px; margin-bottom: 10px; font-weight: 500;">没有数据可供预览</div>
                    <div>请先解析题目或选择题目后再进行预览</div>
                </div>
            `;
            return;
        }

        // 根据格式生成对应的预览
        switch (format) {
            case 'excel':
                setTimeout(() => generateExcelPreview(exportData, previewContent), 100);
                break;
            case 'word':
                setTimeout(() => generateWordPreview(exportData, previewContent), 100);
                break;
            case 'pdf':
                setTimeout(() => generatePDFPreview(exportData, previewContent), 100);
                break;
            default:
                previewContent.innerHTML = `
                    <div style="text-align: center; padding: 60px; color: ${darkMode ? '#aaa' : '#888'};">
                        <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
                        <div style="font-size: 18px; margin-bottom: 10px; font-weight: 500;">不支持预览该格式</div>
                        <div>请选择其他格式进行预览</div>
                    </div>
                `;
        }
    }

    // 生成Excel预览
    function generateExcelPreview(exportData, container) {
        const { data, baseFilename } = exportData;

        // 获取所有唯一的键作为表头
        const allKeys = new Set();
        data.forEach(item => {
            Object.keys(item).forEach(key => allKeys.add(key));
        });

        // 转换为数组并按逻辑排序
        const preferredOrder = ['题目类型', '题目', '选项', '我的答案', '正确答案', '是否正确', '题目解析'];
        const keys = Array.from(allKeys).sort((a, b) => {
            const indexA = preferredOrder.indexOf(a);
            const indexB = preferredOrder.indexOf(b);

            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });

        // 创建表格HTML
        let html = `
            <div style="padding: 20px; animation: ${TOOL_ID}_fadeIn 0.5s;">
                <h2 style="margin-bottom: 25px; text-align: center; color: ${darkMode ? '#eee' : '#333'}; position: relative; padding-bottom: 10px;">
                    ${baseFilename}.xlsx
                    <span style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 100px; height: 3px; background: linear-gradient(90deg, #4285f4, #34a853); border-radius: 3px;"></span>
                </h2>

                <div style="overflow-x: auto; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,${darkMode ? '0.3' : '0.1'});">
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid ${darkMode ? '#444' : '#ddd'}; overflow: hidden;">
                        <thead>
                            <tr style="background: linear-gradient(to right, ${darkMode ? '#333' : '#f5f7fa'}, ${darkMode ? '#2a2a2a' : '#e4e7eb'});">
                                ${keys.map((key, index) => `
                                    <th style="padding: 15px; text-align: left; border: 1px solid ${darkMode ? '#444' : '#ddd'};
                                    animation: ${TOOL_ID}_fadeIn 0.3s ${index * 0.05}s forwards;
                                    opacity: 0;">${key}</th>
                                `).join('')}
                            </tr>
                        </thead>
                        <tbody>
        `;

        // 添加数据行
        data.forEach((item, index) => {
            html += `<tr style="background-color: ${index % 2 === 0 ? (darkMode ? '#2a2a2a' : '#fff') : (darkMode ? '#333' : '#f9f9f9')};
                            animation: ${TOOL_ID}_fadeIn 0.3s ${index * 0.03 + 0.3}s forwards;
                            opacity: 0;">`;
            keys.forEach(key => {
                let cellValue = item[key] || '';

                // 处理特殊情况
                if (key === '图片' && Array.isArray(item[key]) && item[key].length > 0) {
                    cellValue = `<span style="color: ${darkMode ? '#64b5f6' : '#4285f4'};">包含${item[key].length}张图片</span>`;
                } else if (key === '选项' && cellValue) {
                    // 限制预览中的选项长度
                    const options = cellValue.split('\n');
                    if (options.length > 3) {
                        cellValue = options.slice(0, 3).join('<br>') + '<br><span style="color: #aaa;">...</span>';
                    } else {
                        cellValue = options.join('<br>');
                    }
                } else if (cellValue.length > 100) {
                    // 截断过长的文本
                    cellValue = cellValue.substring(0, 100) + '<span style="color: #aaa;">...</span>';
                } else if (key === '是否正确') {
                    if (cellValue === '✓') {
                        cellValue = `<span style="color: ${darkMode ? '#66bb6a' : '#2e7d32'}; font-weight: bold;">✓</span>`;
                    } else if (cellValue === '✗') {
                        cellValue = `<span style="color: ${darkMode ? '#ef5350' : '#d32f2f'}; font-weight: bold;">✗</span>`;
                    }
                }

                html += `<td style="padding: 12px; border: 1px solid ${darkMode ? '#444' : '#ddd'};">${cellValue}</td>`;
            });
            html += '</tr>';
        });

        html += `
                        </tbody>
                    </table>
                </div>
                <div style="margin-top: 25px; text-align: center; color: ${darkMode ? '#aaa' : '#666'}; font-size: 14px;
                     padding: 15px; background: ${darkMode ? '#333' : '#f5f7fa'}; border-radius: 8px;
                     animation: ${TOOL_ID}_fadeIn 0.5s 0.6s forwards; opacity: 0;">
                    <div style="margin-bottom: 8px; font-weight: 500;">数据预览</div>
                    显示 ${data.length} 行数据，完整内容将在Excel文件中可用。
                </div>

                <div style="margin-top: 25px; text-align: center; animation: ${TOOL_ID}_fadeIn 0.5s 0.8s forwards; opacity: 0;">
                    <div class="${TOOL_ID}_btn" style="display: inline-block; margin: 0 auto; cursor: pointer;" onclick="document.getElementById('${TOOL_ID}_download_btn').click()">
                        <span class="${TOOL_ID}_btn_icon">💾</span>下载Excel文件
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // 生成Word预览
    function generateWordPreview(exportData, container) {
        const { data, baseFilename } = exportData;

        // 按题型分组
        const groupedData = data.reduce((groups, item) => {
            const type = item['题目类型'];
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(item);
            return groups;
        }, {});

        // 开始构建HTML
        let html = `
            <div style="padding: 20px; font-family: 'Microsoft YaHei', SimSun, Arial; max-width: 800px; margin: 0 auto;
                  background-color: ${darkMode ? '#222' : 'white'}; color: ${darkMode ? '#eee' : '#333'};
                  border-radius: 8px; box-shadow: 0 0 20px rgba(0,0,0,${darkMode ? '0.3' : '0.1'});
                  animation: ${TOOL_ID}_fadeIn 0.5s;">
                <h1 style="text-align: center; font-size: 18pt; margin-bottom: 25px; position: relative; padding-bottom: 10px;">
                    ${baseFilename}
                    <span style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); width: 100px; height: 3px; background: linear-gradient(90deg, #0F9D58, #34a853); border-radius: 3px;"></span>
                </h1>
        `;

        // 添加每个部分
        Object.keys(groupedData).forEach((type, typeIndex) => {
            const questions = groupedData[type];
            html += `
                <div style="animation: ${TOOL_ID}_fadeIn 0.5s ${0.2 + typeIndex * 0.1}s forwards; opacity: 0;">
                    <h2 style="margin-top: 24px; background: linear-gradient(to right, ${darkMode ? '#333' : '#f5f7fa'}, ${darkMode ? '#2a2a2a' : '#e4e7eb'});
                             padding: 12px 15px; font-size: 14pt; border-radius: 8px; margin-bottom: 20px;">
                        ${type}
                    </h2>
            `;

            // 预览中只显示有限的问题
            const showQuestions = questions.slice(0, 3);
            const remainingCount = questions.length - showQuestions.length;

            // 添加每个问题
            showQuestions.forEach((item, index) => {
                // 处理问题标题
                let questionTitle = processQuestionTitle(item['题目'] || "", index);

                html += `
                    <div style="margin-bottom: 25px; border-bottom: 1px solid ${darkMode ? '#444' : '#eee'};
                          padding-bottom: 20px; animation: ${TOOL_ID}_fadeIn 0.5s ${0.3 + (typeIndex * 0.1) + (index * 0.08)}s forwards;
                          opacity: 0; position: relative;">
                        <div style="font-weight: bold; margin-bottom: 15px; line-height: 1.5; font-size: 15px;">
                            ${questionTitle}
                        </div>
                `;

                // 在题目左侧添加彩色标记
                if (!hideMyAnswers && item['是否正确'] !== '-') {
                    const isCorrect = item['是否正确'] === '✓';
                    html += `
                        <div style="position: absolute; left: -10px; top: 0; bottom: 20px; width: 3px;
                             background-color: ${isCorrect ? (darkMode ? '#66bb6a' : '#2e7d32') : (darkMode ? '#ef5350' : '#d32f2f')};
                             border-radius: 3px;"></div>
                    `;
                }

                // 添加图片占位符
                if (item['图片'] && Array.isArray(item['图片']) && item['图片'].length > 0) {
                    html += `
                        <div style="text-align:center; margin: 15px 0; padding: 30px;
                                  background-color: ${darkMode ? '#333' : '#f5f7fa'};
                                  border-radius: 8px; color: ${darkMode ? '#aaa' : '#888'};
                                  box-shadow: 0 3px 10px rgba(0,0,0,${darkMode ? '0.2' : '0.05'});">
                            <div style="margin-bottom: 15px; font-size: 32px;">🖼️</div>
                            <div style="margin-top: 10px; font-size: 14px;">
                                包含 ${item['图片'].length} 张图片（导出时显示）
                            </div>
                        </div>
                    `;
                }

                // 添加选项
                if (item['选项']) {
                    html += `<div style="margin-left: 24px; margin-bottom: 15px;">`;
                    const options = item['选项'].split('\n');
                    options.forEach((option, i) => {
                        if (option.trim()) {
                            html += `
                                <div style="margin: 8px 0; color: ${darkMode ? '#bbb' : '#555'};
                                     animation: ${TOOL_ID}_fadeIn 0.3s ${0.4 + (i * 0.05)}s forwards;
                                     opacity: 0; padding: 5px 0;">
                                    ${option}
                                </div>
                            `;
                        }
                    });
                    html += `</div>`;
                }

                // 添加答案区域
                html += `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px;">`;

                // 添加我的答案
                if (!hideMyAnswers) {
                    const myAnswer = processAnswer(item['我的答案']);
                    html += `
                        <div style="color: #1976d2; background-color: ${darkMode ? '#0a2742' : '#e3f2fd'};
                             padding: 8px 12px; border-radius: 6px; font-size: 14px; display: inline-block;
                             animation: ${TOOL_ID}_fadeIn 0.3s 0.5s forwards; opacity: 0;
                             box-shadow: 0 2px 5px rgba(25, 118, 210, ${darkMode ? '0.2' : '0.1'});">
                            我的答案: ${myAnswer}
                        </div>
                    `;
                }

                // 添加正确答案
                if (item['正确答案']) {
                    const correctAnswer = processAnswer(item['正确答案']);
                    html += `
                        <div style="color: #2e7d32; background-color: ${darkMode ? '#0f2a19' : '#e8f5e9'};
                             padding: 8px 12px; border-radius: 6px; font-size: 14px; display: inline-block;
                             animation: ${TOOL_ID}_fadeIn 0.3s 0.6s forwards; opacity: 0;
                             box-shadow: 0 2px 5px rgba(46, 125, 50, ${darkMode ? '0.2' : '0.1'});">
                            正确答案: ${correctAnswer}
                        </div>
                    `;
                }

                // 添加答案不匹配指示
                if (!hideMyAnswers && item['是否正确'] === '✗') {
                    html += `
                        <div style="color: #d32f2f; background-color: ${darkMode ? '#3e1c1a' : '#fdecea'};
                             padding: 8px 12px; border-radius: 6px; font-size: 14px; display: inline-block;
                             animation: ${TOOL_ID}_fadeIn 0.3s 0.7s forwards; opacity: 0;
                             box-shadow: 0 2px 5px rgba(211, 47, 47, ${darkMode ? '0.2' : '0.1'});">
                            答案不匹配
                        </div>
                    `;
                }

                html += `</div>`;

                // 添加解析
                if (showExplanation && item['题目解析'] && item['题目解析'] !== '-') {
                    const explanation = item['题目解析'].length > 100 ?
                        item['题目解析'].substring(0, 100) + '...' :
                        item['题目解析'];

                    html += `
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed ${darkMode ? '#444' : '#eee'};
                             animation: ${TOOL_ID}_fadeIn 0.3s 0.8s forwards; opacity: 0; position: relative;">

                            <div style="position: absolute; left: 0; top: 15px; bottom: 0; width: 3px;
                                 background-color: #4285f4; opacity: 0.6; border-radius: 3px;"></div>

                            <div style="font-weight: bold; margin-bottom: 10px; margin-left: 15px; display: flex; align-items: center;">
                                <span style="margin-right: 8px;">💡</span>题目解析:
                            </div>
                            <div style="color: ${darkMode ? '#bbb' : '#333'}; margin-left: 15px;">${explanation}</div>
                        </div>
                    `;
                }

                // 添加AI解答 - 如果有
                if (item.aiAnswer) {
                    const aiAnswer = item.aiAnswer.length > 100 ?
                        item.aiAnswer.substring(0, 100) + '...' :
                        item.aiAnswer;

                    html += `
                        <div style="margin-top: 20px; padding: 15px; background-color: ${darkMode ? '#2d2d3d' : '#f9f9ff'};
                             padding: 15px; border-left: 4px solid #4d76ff; border-radius: 6px;
                             animation: ${TOOL_ID}_fadeIn 0.3s 0.9s forwards; opacity: 0;
                             box-shadow: 0 3px 10px rgba(77, 118, 255, ${darkMode ? '0.2' : '0.1'});">
                            <div style="font-weight: bold; margin-bottom: 10px; color: #4d76ff; display: flex; align-items: center;">
                                <span style="margin-right: 8px;">🤖</span>AI解答:
                            </div>
                            <div style="color: ${darkMode ? '#bbb' : '#333'};">${formatAnswer(aiAnswer)}</div>
                        </div>
                    `;
                }

                html += `</div>`;
            });

            // 显示剩余数量
            if (remainingCount > 0) {
                html += `
                    <div style="text-align: center; padding: 20px; margin-bottom: 20px;
                          background-color: ${darkMode ? '#333' : '#f5f7fa'}; border-radius: 8px;
                          color: ${darkMode ? '#aaa' : '#666'}; animation: ${TOOL_ID}_fadeIn 0.5s ${0.5 + (typeIndex * 0.1)}s forwards;
                          opacity: 0; box-shadow: 0 3px 10px rgba(0,0,0,${darkMode ? '0.2' : '0.05'});">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom: 10px;">
                            <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                        </svg>
                        <div style="font-weight: 500; margin-bottom: 5px;">
                            还有 ${remainingCount} 道题未显示在预览中
                        </div>
                        <div style="font-size: 13px;">
                            完整内容将在Word文档中可用
                        </div>
                    </div>
                `;
            }

            html += `</div>`;
        });

        html += `
                <div style="margin-top: 30px; text-align: center; padding: 20px;
                      background-color: ${darkMode ? '#333' : '#f5f7fa'}; border-radius: 8px;
                      color: ${darkMode ? '#aaa' : '#666'}; animation: ${TOOL_ID}_fadeIn 0.5s 1s forwards;
                      opacity: 0; box-shadow: 0 3px 10px rgba(0,0,0,${darkMode ? '0.2' : '0.05'});">
                    <div style="font-weight: 500; margin-bottom: 5px;">
                        预览效果
                    </div>
                    <div style="margin-bottom: 15px;">
                        完整内容将在Word文档中可用
                    </div>
                    <button class="${TOOL_ID}_btn" style="margin: 0 auto; display: inline-block; background: linear-gradient(135deg, #0F9D58, #34a853);" onclick="document.getElementById('${TOOL_ID}_download_btn').click()">
                        <span class="${TOOL_ID}_btn_icon">💾</span>下载Word文件
                    </button>
                </div>
            </div>
        `;

        container.innerHTML = html;
    }

    // 生成PDF预览
    function generatePDFPreview(exportData, container) {
        const { data, baseFilename } = exportData;

        // 类似于Word预览，但添加页面分隔
        const groupedData = data.reduce((groups, item) => {
            const type = item['题目类型'];
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(item);
            return groups;
        }, {});

        // 开始构建带有PDF样式页面的HTML
        let html = `<div style="padding: 20px; max-width: 800px; margin: 0 auto; background-color: ${darkMode ? '#222' : 'white'};
                    color: ${darkMode ? '#eee' : '#333'}; font-family: 'Microsoft YaHei', SimSun, Arial;
                    border: 1px solid ${darkMode ? '#444' : '#ddd'}; border-radius: 8px;
                    box-shadow: 0 0 25px rgba(0,0,0,${darkMode ? '0.3' : '0.15'}); animation: ${TOOL_ID}_fadeIn 0.5s;">`;

        // 第一页 - 标题页
        html += `
            <div style="position: relative; margin-bottom: 30px; padding-bottom: 30px;
                  border-bottom: 2px dashed ${darkMode ? '#555' : '#ccc'};
                  animation: ${TOOL_ID}_fadeIn 0.3s 0.1s forwards; opacity: 0;">
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="font-size: 18px; color: ${darkMode ? '#aaa' : '#666'};
                         margin-bottom: 20px; letter-spacing: 2px; text-transform: uppercase;">
                        PDF预览
                    </div>
                    <h1 style="font-size: 24pt; margin-bottom: 40px; position: relative; display: inline-block; padding-bottom: 10px;">
                        ${baseFilename.replace('.pdf', '')}
                        <span style="position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #DB4437, #F4B400); border-radius: 3px;"></span>
                    </h1>
                    <div style="margin-top: 50px; color: ${darkMode ? '#aaa' : '#666'}; font-size: 14px;
                         animation: ${TOOL_ID}_fadeIn 0.3s 0.4s forwards; opacity: 0;">
                        总共 ${data.length} 道题目
                    </div>
                    <div style="margin-top: 10px; color: ${darkMode ? '#aaa' : '#666'}; font-size: 14px;
                         animation: ${TOOL_ID}_fadeIn 0.3s 0.5s forwards; opacity: 0;">
                        包含 ${Object.keys(groupedData).length} 种题型
                    </div>
                    <div style="margin-top: 50px; color: ${darkMode ? '#aaa' : '#666'}; font-size: 12px;
                         animation: ${TOOL_ID}_fadeIn 0.3s 0.6s forwards; opacity: 0;">
                        生成时间: ${new Date().toLocaleString()}
                    </div>
                </div>
                <div style="position: absolute; bottom: 10px; right: 10px; font-size: 12px; color: ${darkMode ? '#aaa' : '#888'};">1</div>
            </div>
        `;

        // 内容页 - 在预览中限制为2页
        let currentPage = 2;
        let typesShown = 0;

        for (const type of Object.keys(groupedData)) {
            // 限制在预览中只显示2种题型
            if (typesShown >= 2) {
                break;
            }

            const questions = groupedData[type];

            html += `
                <div style="position: relative; margin-bottom: 30px; padding-bottom: 30px;
                      border-bottom: 2px dashed ${darkMode ? '#555' : '#ccc'};
                      animation: ${TOOL_ID}_fadeIn 0.3s ${0.7 + typesShown * 0.1}s forwards; opacity: 0;">
                    <h2 style="margin-top: 20px; background: linear-gradient(to right, ${darkMode ? '#333' : '#f5f7fa'}, ${darkMode ? '#2a2a2a' : '#e4e7eb'});
                         padding: 12px 15px; font-size: 14pt; border-radius: 8px; margin-bottom: 20px;">
                        ${type}
                    </h2>
            `;

            // 只显示几个问题
            const showQuestions = questions.slice(0, 2);
            const remainingCount = questions.length - showQuestions.length;

            showQuestions.forEach((item, index) => {
                let questionTitle = processQuestionTitle(item['题目'] || "", index);

                html += `
                    <div style="margin-bottom: 20px; border-bottom: 1px solid ${darkMode ? '#444' : '#eee'};
                          padding-bottom: 15px; animation: ${TOOL_ID}_fadeIn 0.3s ${0.8 + typesShown * 0.1 + index * 0.1}s forwards;
                          opacity: 0; position: relative;">
                        <div style="font-weight: bold; margin-bottom: 12px; line-height: 1.5;">
                            ${questionTitle}
                        </div>
                `;

                // 在题目左侧添加彩色标记
                if (!hideMyAnswers && item['是否正确'] !== '-') {
                    const isCorrect = item['是否正确'] === '✓';
                    html += `
                        <div style="position: absolute; left: -10px; top: 0; bottom: 15px; width: 3px;
                             background-color: ${isCorrect ? (darkMode ? '#66bb6a' : '#2e7d32') : (darkMode ? '#ef5350' : '#d32f2f')};
                             border-radius: 3px;"></div>
                    `;
                }

                // 简化的预览内容 - 只显示基本信息
                if (item['选项']) {
                    const options = item['选项'].split('\n');
                    if (options.length > 0) {
                        html += `<div style="margin-left: 24px; margin-bottom: 12px; color: ${darkMode ? '#bbb' : '#555'};">`;
                        const displayOptions = options.slice(0, Math.min(options.length, 4));
                        displayOptions.forEach((option, i) => {
                            if (option.trim()) {
                                html += `
                                    <div style="margin: 6px 0; animation: ${TOOL_ID}_fadeIn 0.3s ${0.9 + typesShown * 0.1 + index * 0.1 + i * 0.05}s forwards;
                                         opacity: 0;">
                                        ${option}
                                    </div>
                                `;
                            }
                        });
                        if (options.length > 4) {
                            html += `<div style="margin: 6px 0; color: ${darkMode ? '#888' : '#999'};">...</div>`;
                        }
                        html += `</div>`;
                    }
                }

                // 添加答案部分
                html += `<div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">`;
                if (item['正确答案']) {
                    html += `
                        <div style="color: #2e7d32; background-color: ${darkMode ? '#0f2a19' : '#e8f5e9'};
                             padding: 8px 12px; border-radius: 6px; font-size: 14px; display: inline-block;
                             animation: ${TOOL_ID}_fadeIn 0.3s ${1.0 + typesShown * 0.1 + index * 0.1}s forwards;
                             opacity: 0; box-shadow: 0 2px 5px rgba(46, 125, 50, ${darkMode ? '0.2' : '0.1'});">
                            正确答案: ${item['正确答案']}
                        </div>
                    `;
                }
                html += `</div>`;

                // 添加AI解答 - 如果有
                if (item.aiAnswer) {
                    const aiAnswer = item.aiAnswer.length > 100 ?
                        item.aiAnswer.substring(0, 100) + '...' :
                        item.aiAnswer;

                    html += `
                        <div style="margin-top: 15px; padding: 15px; background-color: ${darkMode ? '#2d2d3d' : '#f9f9ff'};
                             padding: 15px; border-left: 4px solid #4d76ff; border-radius: 6px;
                             animation: ${TOOL_ID}_fadeIn 0.3s ${1.1 + typesShown * 0.1 + index * 0.1}s forwards;
                             opacity: 0; box-shadow: 0 3px 10px rgba(77, 118, 255, ${darkMode ? '0.2' : '0.1'});">
                            <div style="font-weight: bold; margin-bottom: 8px; color: #4d76ff; display: flex; align-items: center;">
                                <span style="margin-right: 8px;">🤖</span>AI解答:
                            </div>
                            <div style="color: ${darkMode ? '#bbb' : '#333'};">${formatAnswer(aiAnswer)}</div>
                        </div>
                    `;
                }

                html += `</div>`;
            });

            // 显示剩余数量
            if (remainingCount > 0) {
                html += `
                    <div style="text-align: center; padding: 15px; margin-bottom: 15px;
                          background-color: ${darkMode ? '#333' : '#f5f7fa'}; border-radius: 8px;
                          color: ${darkMode ? '#aaa' : '#666'}; font-size: 13px;
                          animation: ${TOOL_ID}_fadeIn 0.3s ${1.2 + typesShown * 0.1}s forwards;
                          opacity: 0; box-shadow: 0 3px 10px rgba(0,0,0,${darkMode ? '0.2' : '0.05'});">
                        还有 ${remainingCount} 道题未显示在预览中
                    </div>
                `;
            }

            html += `<div style="position: absolute; bottom: 10px; right: 10px; font-size: 12px; color: ${darkMode ? '#aaa' : '#888'};">${currentPage}</div></div>`;
            currentPage++;
            typesShown++;
        }

        // 如果还有更多题型未显示
        if (typesShown < Object.keys(groupedData).length) {
            const remainingTypes = Object.keys(groupedData).length - typesShown;

            html += `
                <div style="position: relative; margin-bottom: 30px; padding-bottom: 30px;
                      border-bottom: 2px dashed ${darkMode ? '#555' : '#ccc'};
                      animation: ${TOOL_ID}_fadeIn 0.3s ${1.3}s forwards; opacity: 0;">
                    <div style="text-align: center; padding: 50px 20px;">
                        <div style="font-size: 40px; margin-bottom: 20px; animation: ${TOOL_ID}_pulse 2s infinite;">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 8V12M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                            </svg>
                        </div>
                        <div style="font-size: 16px; margin-bottom: 20px; color: ${darkMode ? '#bbb' : '#555'}; font-weight: 500;">
                            还有 ${remainingTypes} 种题型未在预览中显示
                        </div>
                        <div style="color: ${darkMode ? '#aaa' : '#666'}; margin-top: 30px; font-size: 14px;">
                            完整内容将在PDF文件中包含 ${currentPage - 1 + Math.ceil(remainingTypes * 1.5)} 页左右
                        </div>
                    </div>
                    <div style="position: absolute; bottom: 10px; right: 10px; font-size: 12px; color: ${darkMode ? '#aaa' : '#888'};">${currentPage}</div>
                </div>
            `;
        }

        html += `
                <div style="margin-top: 30px; text-align: center; padding: 20px;
                      background-color: ${darkMode ? '#333' : '#f5f7fa'}; border-radius: 8px;
                      color: ${darkMode ? '#aaa' : '#666'}; animation: ${TOOL_ID}_fadeIn 0.3s 1.5s forwards;
                      opacity: 0; box-shadow: 0 3px 10px rgba(0,0,0,${darkMode ? '0.2' : '0.05'});">
                    <div style="font-weight: 500; margin-bottom: 5px;">
                        预览效果
                    </div>
                    <div style="margin-bottom: 15px;">
                        完整内容将在PDF文档中可用
                    </div>
                    <button class="${TOOL_ID}_btn" style="margin: 0 auto; display: inline-block; background: linear-gradient(135deg, #DB4437, #F4B400);" onclick="document.getElementById('${TOOL_ID}_download_btn').click()">
                        <span class="${TOOL_ID}_btn_icon">💾</span>下载PDF文件
                    </button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    // ===== 初始化 =====
    // 检查页面是否包含题目
    function hasQuestions() {
        return document.getElementsByClassName("mark_item").length > 0 ||
               document.getElementsByClassName("questionLi").length > 0;
    }

    // 初始化工具
    function initTool() {
        if (toolInitialized) return;

        if (hasQuestions()) {
            // 先加载保存的设置
            loadSettings();

            insertStyle();
            createFloatingButton();
            createAIFloatingButton();
            toolInitialized = true;
            console.log("题目解析工具已初始化");

            // 显示初始化通知
            if (animationsEnabled) {
                setTimeout(() => {
                    showToast("题目解析工具已初始化，点击右下角按钮打开工具", "info", 5000);
                }, 1000);
            }
        } else {
            console.log("当前页面未找到题目，工具未初始化");
        }
    }

    // 设置页面观察器，处理动态加载的内容
    function setupPageObserver() {
        // 使用MutationObserver监视DOM变化
        const observer = new MutationObserver(function(mutations) {
            if (!toolInitialized && hasQuestions()) {
                initTool();
            }
        });

        // 开始观察document.body
        observer.observe(document.body, { childList: true, subtree: true });

        // 每隔2秒检查一次
        setInterval(function() {
            if (!toolInitialized && hasQuestions()) {
                initTool();
            }
        }, 2000);
    }

    // 在页面加载后初始化
    function initialize() {
        if (document.readyState === 'loading') {
            window.addEventListener('load', function() {
                initTool();
                setupPageObserver();
            });
        } else {
            initTool();
            setupPageObserver();
        }
    }

    // 执行初始化
    initialize();
})();