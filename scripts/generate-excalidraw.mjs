import fs from 'fs';
import path from 'path';

// Define the groups and their pages
const groups = [
  {
    title: "Core / Public",
    color: "#e0f2fe", // Light blue
    pages: [
      { path: "/", name: "Home" },
      { path: "/about", name: "About" },
      { path: "/login", name: "Login" }
    ]
  },
  {
    title: "Directories / Discovery",
    color: "#fce7f3", // Light pink
    pages: [
      { path: "/developers", name: "Developers Directory" },
      { path: "/stacks", name: "Stacks Directory" },
      { path: "/top-stackers", name: "Top Stackers" },
      { path: "/leaderboard", name: "Leaderboard Hub" },
      { path: "/leaderboard/repos", name: "Top Repos" },
      { path: "/leaderboard/stacks", name: "Top Stacks" },
      { path: "/leaderboard/skills", name: "Top Skills" },
      { path: "/leaderboard/ai-tools", name: "AI Tools Leaderboard" },
      { path: "/leaderboard/bots", name: "Bots Leaderboard" }
    ]
  },
  {
    title: "Entity Pages (Dynamic)",
    color: "#dcfce7", // Light fuchsia/emerald
    pages: [
      { path: "/[owner]", name: "User Profile" },
      { path: "/[owner]/[repo]", name: "Repository Page" },
      { path: "/package/[...name]", name: "Package Details" },
      { path: "/language/[name]", name: "Language Ecosystem" },
      { path: "/topic/[name]", name: "Topic Ecosystem" }
    ]
  },
  {
    title: "Authenticated / Private",
    color: "#fef08a", // Light amber/yellow
    pages: [
      { path: "/feed", name: "Activity Feed" },
      { path: "/notifications", name: "Notifications" },
      { path: "/messages", name: "Messages Inbox" },
      { path: "/messages/[id]", name: "Conversation" },
      { path: "/settings", name: "Settings Overview" },
      { path: "/settings/account", name: "Account Settings" },
      { path: "/settings/notifications", name: "Notification Prefs" }
    ]
  },
  {
    title: "Utility & Docs",
    color: "#f3f4f6", // Gray
    pages: [
      { path: "/invite/[code]", name: "Invite Redemption" },
      { path: "/ranks", name: "Ranks Overview" },
      { path: "/docs/ranks", name: "Ranks Documentation" }
    ]
  }
];

const elements = [];
let currentY = -400;
const startX = -400;
const boxWidth = 350;
const boxHeight = 60;
const gapY = 20;
const gapX = 450;
let groupX = startX;
let groupY = currentY;

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// Title
elements.push({
  id: generateId(),
  type: "text",
  x: startX,
  y: groupY - 100,
  width: 400,
  height: 50,
  angle: 0,
  strokeColor: "#000000",
  backgroundColor: "transparent",
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  groupIds: [],
  strokeSharpness: "sharp",
  seed: Math.floor(Math.random() * 1000),
  version: 1,
  versionNonce: 0,
  isDeleted: false,
  boundElements: null,
  updated: Date.now(),
  link: null,
  locked: false,
  text: "StackMatch Page Architecture",
  fontSize: 36,
  fontFamily: 1,
  textAlign: "left",
  verticalAlign: "top",
  baseline: 43,
  containerId: null,
  originalText: "StackMatch Page Architecture",
});


groups.forEach((group, index) => {
  // Move to next column after 2 groups
  if (index > 0 && index % 2 === 0) {
    groupX += gapX;
    groupY = currentY;
  }

  // Group Background
  const groupBgId = generateId();
  const groupHeight = (group.pages.length * (boxHeight + gapY)) + 80;
  
  elements.push({
    id: groupBgId,
    type: "rectangle",
    x: groupX - 20,
    y: groupY - 20,
    width: boxWidth + 40,
    height: groupHeight,
    angle: 0,
    strokeColor: "#ced4da",
    backgroundColor: group.color,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "dashed",
    roughness: 0,
    opacity: 50,
    groupIds: [],
    strokeSharpness: "round",
    seed: Math.floor(Math.random() * 1000),
    version: 1,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
  });

  // Group Title
  elements.push({
    id: generateId(),
    type: "text",
    x: groupX,
    y: groupY,
    width: boxWidth,
    height: 30,
    angle: 0,
    strokeColor: "#000000",
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    strokeSharpness: "sharp",
    seed: Math.floor(Math.random() * 1000),
    version: 1,
    versionNonce: 0,
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    text: group.title,
    fontSize: 24,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    baseline: 28,
    containerId: null,
    originalText: group.title,
  });

  let itemY = groupY + 50;

  group.pages.forEach(page => {
    const rectId = generateId();
    
    // Box
    elements.push({
      id: rectId,
      type: "rectangle",
      x: groupX,
      y: itemY,
      width: boxWidth,
      height: boxHeight,
      angle: 0,
      strokeColor: "#1e293b",
      backgroundColor: "#ffffff",
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      groupIds: [],
      strokeSharpness: "round",
      seed: Math.floor(Math.random() * 1000),
      version: 1,
      versionNonce: 0,
      isDeleted: false,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
    });

    // Text - Name
    elements.push({
      id: generateId(),
      type: "text",
      x: groupX + 15,
      y: itemY + 10,
      width: boxWidth - 30,
      height: 20,
      angle: 0,
      strokeColor: "#000000",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      strokeSharpness: "sharp",
      seed: Math.floor(Math.random() * 1000),
      version: 1,
      versionNonce: 0,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: page.name,
      fontSize: 18,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: 21,
      containerId: null,
      originalText: page.name,
    });

    // Text - Path
    elements.push({
      id: generateId(),
      type: "text",
      x: groupX + 15,
      y: itemY + 35,
      width: boxWidth - 30,
      height: 15,
      angle: 0,
      strokeColor: "#64748b",
      backgroundColor: "transparent",
      fillStyle: "hachure",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 1,
      opacity: 100,
      groupIds: [],
      strokeSharpness: "sharp",
      seed: Math.floor(Math.random() * 1000),
      version: 1,
      versionNonce: 0,
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      text: page.path,
      fontSize: 14,
      fontFamily: 2, // monospace
      textAlign: "left",
      verticalAlign: "top",
      baseline: 16,
      containerId: null,
      originalText: page.path,
    });

    itemY += boxHeight + gapY;
  });

  groupY += groupHeight + 40;
});

const excalidrawState = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: elements,
  appState: {
    gridSize: null,
    viewBackgroundColor: "#f8fafc",
  },
  files: {}
};

fs.writeFileSync('docs/pages-architecture.excalidraw', JSON.stringify(excalidrawState, null, 2));
console.log("Excalidraw file generated at docs/pages-architecture.excalidraw");
