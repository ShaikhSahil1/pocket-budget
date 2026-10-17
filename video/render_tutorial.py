from __future__ import annotations

import math
import subprocess
import sys
import textwrap
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent.parent
VIDEO_DIR = ROOT / "video"
BUILD = VIDEO_DIR / "build"
OUTPUT = VIDEO_DIR / "Pocket-How-To-Guide.mp4"
NARRATION_FILE = VIDEO_DIR / "Pocket-How-To-Narration.txt"
PYTHON_DEPS = Path(r"C:\Users\SAHIL\AppData\Local\Temp\pocket-video-deps")
PWSH = Path(r"C:\Users\SAHIL\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe")

sys.path.insert(0, str(PYTHON_DEPS))
import imageio_ffmpeg  # noqa: E402

FFMPEG = Path(imageio_ffmpeg.get_ffmpeg_exe())
W, H = 1920, 1080

FOREST = "#173f35"
GREEN = "#275446"
INK = "#223c35"
MUTED = "#76837c"
CREAM = "#f4f2e9"
PAPER = "#fbfcf8"
SAGE = "#e7eee0"
LIME = "#cce59a"
LINE = "#dce3d8"
GOLD = "#e8c182"
BLUE = "#9ebfc0"
WHITE = "#ffffff"


SCENES = [
    {
        "chapter": "WELCOME",
        "title": "Meet Pocket",
        "subtitle": "A calmer way to manage each month",
        "panel": "welcome",
        "narration": (
            "Welcome to Pocket, a private monthly budget workspace designed to make money management feel clear and calm. "
            "In this guide, we will walk through every major feature: secure Google sign-in, monthly balances, expenses, "
            "reimbursements, leave tracking, mini tools, backups, and data controls."
        ),
    },
    {
        "chapter": "PRIVACY & SIGN-IN",
        "title": "Your account. Your Sheet.",
        "subtitle": "Connect once to open your private workspace",
        "panel": "signin",
        "narration": (
            "Start by selecting Open Pocket, then sign in with Google. Pocket uses your verified Google account to keep workspaces separate. "
            "It creates or finds one private spreadsheet in your Google Drive and writes your workspace to the Pocket Data tab. "
            "Pocket does not keep a separate central database of your budget records. A working copy remains in this browser, so use a trusted browser profile on shared devices."
        ),
    },
    {
        "chapter": "OVERVIEW",
        "title": "Read your month at a glance",
        "subtitle": "Balance, spending, reimbursements, and daily allowance",
        "panel": "overview",
        "narration": (
            "The Overview is your monthly command center. Available balance shows what remains after expenses and received reimbursements. "
            "Starting balance combines this month's new funds with any positive amount carried forward. Total expenses summarizes the selected month, "
            "and Awaiting reimbursement shows money that has not yet returned. The chart explains where your money went, while the daily allowance turns the remaining balance into a practical daily guide."
        ),
    },
    {
        "chapter": "MONTHLY BALANCE",
        "title": "Set the money available this month",
        "subtitle": "Enter only new funds—Pocket handles carry-forward",
        "panel": "balance",
        "narration": (
            "Choose Set monthly balance and enter only the new funds received for that month. Do not add last month's remaining money yourself. "
            "Pocket automatically carries forward positive unused balances, including across skipped months and year boundaries. Negative balances remain visible in their original month but are not carried into the next one."
        ),
    },
    {
        "chapter": "EXPENSES",
        "title": "Add, organize, and find expenses",
        "subtitle": "Every record stays editable",
        "panel": "expense",
        "narration": (
            "Select Add expense, then enter a name, amount, date, category, and optional details. Categories include Business Trip, Reimbursable, Personal Buying, and Monthly Travelling. "
            "Save the record to update every total immediately. Use the category navigation to focus the table, search by name or details, edit a record when something changes, or delete it when it is no longer needed."
        ),
    },
    {
        "chapter": "REIMBURSEMENTS",
        "title": "Track money that should come back",
        "subtitle": "Pending and received stay clearly separated",
        "panel": "refund",
        "narration": (
            "For a refundable purchase, enable This expense will be reimbursed, or use the Reimbursable category. Pocket counts the cost as an expense and adds it to Awaiting reimbursement. "
            "When the money arrives, select Pending refund to mark it Received. Pocket then adds that amount back to the available balance exactly once."
        ),
    },
    {
        "chapter": "MONTH CONTROLS",
        "title": "Navigate, export, and clear safely",
        "subtitle": "Move through history without losing context",
        "panel": "month",
        "narration": (
            "Use the month arrows or month picker to review any period. Export CSV downloads the selected month's expenses together with new funds, carry-forward, and the combined starting balance. "
            "Clear month lets you remove the selected month's budget records, leave records, or both. Pocket shows record counts, offers a backup first, and requires the exact year and month before deletion. Other months and recurring leave allowances are preserved."
        ),
    },
    {
        "chapter": "LEAVE TRACKER",
        "title": "Track time off beside your budget",
        "subtitle": "Casual, medical, and comp-off balances",
        "panel": "leaves",
        "narration": (
            "Open Leaves and set monthly allowances for casual, medical, and comp-off leave. Half days are supported. Casual leave repeats from the month you set it until the next change, while medical and comp-off credits apply only when entered. "
            "Add a leave for each date, include details or a reason, and edit or delete it later. Positive unused leave carries forward, while negative balances do not."
        ),
    },
    {
        "chapter": "PROFILE & BACKUPS",
        "title": "Control sync and portable backups",
        "subtitle": "Your recovery tools live in the profile panel",
        "panel": "profile",
        "narration": (
            "Select your profile in the sidebar to manage the Google connection. Open my Google Sheet takes you directly to the private spreadsheet. "
            "Load from Google replaces the local workspace with the cloud copy, while Save to Google sends the local copy to the Sheet. Download full backup creates a portable JSON file, and Restore backup replaces the workspace after confirmation. "
            "Log out hides the account's data on screen and ends the Google connection."
        ),
    },
    {
        "chapter": "CURRENCY",
        "title": "Choose a display currency",
        "subtitle": "Format budgets or calculate live conversions",
        "panel": "currency",
        "narration": (
            "Use the currency menu to change how budget amounts are displayed. You can save the choice to your account, use it temporarily until reload, or cancel. "
            "Changing the display currency does not convert existing budget amounts. For conversion, open Mini tools and choose Currency converter. Enter an amount, select the two currencies, swap direction when needed, and refresh the public daily rate. Your budget records are not sent to the rate provider."
        ),
    },
    {
        "chapter": "TRAVEL PLANNER",
        "title": "Plan trips without another app",
        "subtitle": "Notes, packing, tasks, and progress",
        "panel": "travel",
        "narration": (
            "In Mini tools, choose Travel planner. Create a named plan and add free-form notes for booking details or ideas. Packing and Tasks are separate checklists, each with its own progress. "
            "You can add, rename, complete, or delete individual items, edit the plan, or remove it after confirmation. Travel plans use the same account-specific browser storage and Google Sheet backup as the rest of Pocket."
        ),
    },
    {
        "chapter": "YOU ARE READY",
        "title": "A little more in control",
        "subtitle": "Build the habit one month at a time",
        "panel": "finish",
        "narration": (
            "That is Pocket. Start each month with new funds, record expenses as they happen, close reimbursement loops, and keep an eye on the available balance. "
            "Use exports and backups whenever you want a portable copy, and remember that your cloud workspace lives in your own private Google Sheet. "
            "Open Pocket and make a little more room for what matters."
        ),
    },
]


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    candidates = {
        "regular": [r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\arial.ttf"],
        "semibold": [r"C:\Windows\Fonts\seguisb.ttf", r"C:\Windows\Fonts\arialbd.ttf"],
        "bold": [r"C:\Windows\Fonts\segoeuib.ttf", r"C:\Windows\Fonts\arialbd.ttf"],
        "serif": [r"C:\Windows\Fonts\georgia.ttf", r"C:\Windows\Fonts\times.ttf"],
    }
    for candidate in candidates[name]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


F9, F11, F13, F15 = font("regular", 20), font("regular", 25), font("regular", 30), font("regular", 34)
B10, B12, B15, B20, B28, B42 = [font("semibold", n) for n in (22, 26, 32, 42, 58, 86)]
SERIF = font("serif", 78)


def rounded(draw, box, radius=18, fill=WHITE, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def txt(draw, xy, text, fnt, fill=INK, anchor=None, **kwargs):
    draw.text(xy, text, font=fnt, fill=fill, anchor=anchor, **kwargs)


def brand(draw, x, y, compact=False):
    radius = 10 if compact else 13
    cy = y + 2
    draw.ellipse((x, cy - radius, x + radius * 2, cy + radius), outline=GREEN, width=3)
    draw.pieslice((x + 4, cy - radius + 4, x + radius * 2 - 4, cy + radius - 4), 90, 270, fill=GREEN)
    label_font = B12 if compact else B15
    txt(draw, (x + radius * 2 + 10, y), "pocket", label_font, GREEN, "lm")
    dot_x = x + radius * 2 + 10 + draw.textlength("pocket", font=label_font) + 2
    txt(draw, (dot_x, y), ".", label_font, "#91a966", "lm")


def wrap(draw, text, fnt, width_px):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = (current + " " + word).strip()
        if draw.textbbox((0, 0), candidate, font=fnt)[2] <= width_px:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def money_card(draw, x, y, w, label, value, dark=False, note=""):
    fill = GREEN if dark else WHITE
    color = WHITE if dark else INK
    rounded(draw, (x, y, x + w, y + 190), 16, fill, None if dark else LINE)
    txt(draw, (x + 25, y + 24), label.upper(), F9, "#b9c9c0" if dark else MUTED)
    txt(draw, (x + 25, y + 76), value, B20, color)
    txt(draw, (x + 25, y + 145), note, F9, "#b9c9c0" if dark else MUTED)


def pill(draw, x, y, label, active=False, w=None):
    w = w or max(125, 38 + int(draw.textlength(label, font=F9)))
    rounded(draw, (x, y, x + w, y + 42), 21, GREEN if active else SAGE, None)
    txt(draw, (x + w / 2, y + 21), label, F9, WHITE if active else INK, "mm")
    return w


def app_shell(draw, scene):
    x, y, w, h = 355, 120, 1495, 820
    rounded(draw, (x, y, x + w, y + h), 22, WHITE, LINE, 2)
    draw.rectangle((x, y, x + 245, y + h), fill="#f8faf6")
    draw.line((x + 245, y, x + 245, y + h), fill=LINE, width=2)
    brand(draw, x + 35, y + 38, compact=True)
    txt(draw, (x + 35, y + 115), "YOUR WORKSPACE", F9, MUTED)
    navs = ["Overview", "Business Trip", "Reimbursable", "Personal Buying", "Monthly Travelling", "Leaves", "Mini tools"]
    active = {
        "leaves": "Leaves", "currency": "Mini tools", "travel": "Mini tools", "profile": "Overview"
    }.get(scene, "Overview")
    for i, label in enumerate(navs):
        ny = y + 150 + i * 55
        if label == active:
            rounded(draw, (x + 20, ny, x + 220, ny + 43), 8, SAGE)
        txt(draw, (x + 42, ny + 21), label, F9, GREEN if label == active else MUTED, "lm")
    rounded(draw, (x + 23, y + h - 83, x + 220, y + h - 25), 8, "#f1f4ea")
    txt(draw, (x + 44, y + h - 54), "ME   My private space", F9, INK, "lm")
    draw.rectangle((x + 245, y, x + w, y + 66), fill="#fcfcfa")
    draw.line((x + 245, y + 66, x + w, y + 66), fill=LINE, width=1)
    txt(draw, (x + 280, y + 33), "My workspace  /", F9, MUTED, "lm")
    txt(draw, (x + 405, y + 33), active, F9, INK, "lm")
    txt(draw, (x + w - 35, y + 33), "●  Saved for your account", F9, "#678267", "rm")
    return x + 285, y + 95, w - 325, h - 125


def overview(draw, cx, cy, cw, ch):
    txt(draw, (cx, cy), "Your month, at a glance.", B20)
    txt(draw, (cx, cy + 55), "October 2026", F11, MUTED)
    card_w = (cw - 36) // 4
    money_card(draw, cx, cy + 100, card_w, "Available balance", "₹42,680", True, "71% remaining")
    money_card(draw, cx + card_w + 12, cy + 100, card_w, "Starting balance", "₹60,000", False, "Includes ₹6,400 carried")
    money_card(draw, cx + (card_w + 12) * 2, cy + 100, card_w, "Total expenses", "₹17,320", False, "8 expenses")
    money_card(draw, cx + (card_w + 12) * 3, cy + 100, card_w, "Awaiting refund", "₹1,150", False, "1 pending")
    rounded(draw, (cx, cy + 315, cx + cw * .58, cy + ch), 14, WHITE, LINE)
    txt(draw, (cx + 25, cy + 342), "Where your money goes", B12)
    center = (int(cx + 150), int(cy + 505))
    draw.ellipse((center[0] - 100, center[1] - 100, center[0] + 100, center[1] + 100), fill=GREEN)
    draw.pieslice((center[0] - 100, center[1] - 100, center[0] + 100, center[1] + 100), 20, 105, fill=GOLD)
    draw.pieslice((center[0] - 100, center[1] - 100, center[0] + 100, center[1] + 100), 105, 185, fill=BLUE)
    draw.ellipse((center[0] - 65, center[1] - 65, center[0] + 65, center[1] + 65), fill=WHITE)
    txt(draw, center, "₹17,320", B12, INK, "mm")
    labels = [("Personal buying", "₹7,850", GREEN), ("Monthly travel", "₹4,620", GOLD), ("Business trip", "₹3,700", BLUE), ("Reimbursable", "₹1,150", LIME)]
    for i, (label, val, color) in enumerate(labels):
        ly = cy + 405 + i * 52
        draw.ellipse((cx + 295, ly + 5, cx + 307, ly + 17), fill=color)
        txt(draw, (cx + 320, ly), label, F9, MUTED)
        txt(draw, (cx + cw * .55 - 20, ly), val, F9, INK, "ra")
    rounded(draw, (cx + cw * .61, cy + 315, cx + cw, cy + ch), 14, "#eef3e7")
    txt(draw, (cx + cw * .65, cy + 355), "MONTHLY PERSPECTIVE", F9, "#789069")
    txt(draw, (cx + cw * .65, cy + 410), "A little planning.\nA better month.", B15, INK, spacing=8)
    txt(draw, (cx + cw * .65, cy + 530), "Daily spending allowance", F9, MUTED)
    txt(draw, (cx + cw * .65, cy + 570), "₹2,134", B20, GREEN)


def draw_panel(draw, scene, cx, cy, cw, ch):
    if scene in ("overview", "welcome", "finish"):
        overview(draw, cx, cy, cw, ch)
        return
    if scene == "signin":
        txt(draw, (cx, cy), "Your private Google workspace", B20)
        txt(draw, (cx, cy + 55), "Sign in to see your own budget and leaves.", F11, MUTED)
        rounded(draw, (cx, cy + 120, cx + cw, cy + 390), 16, "#eef3e7")
        txt(draw, (cx + 45, cy + 165), "G", B28, GREEN)
        txt(draw, (cx + 145, cy + 155), "Sign in with Google", B15)
        txt(draw, (cx + 145, cy + 205), "Identity + access only to the files Pocket creates", F11, MUTED)
        pill(draw, cx + 145, cy + 270, "Continue with Google", True, 250)
        rounded(draw, (cx, cy + 430, cx + cw, cy + ch), 14, WHITE, LINE)
        items = [("1", "Verify your account"), ("2", "Find or create your private Sheet"), ("3", "Sync this browser's working copy")]
        for i, (n, label) in enumerate(items):
            ix = cx + 40 + i * (cw / 3)
            draw.ellipse((ix, cy + 485, ix + 48, cy + 533), fill=LIME)
            txt(draw, (ix + 24, cy + 509), n, B10, GREEN, "mm")
            txt(draw, (ix, cy + 555), label, F9, INK)
        return
    if scene == "balance":
        overview(draw, cx, cy, cw, ch)
        rounded(draw, (cx + 235, cy + 125, cx + cw - 235, cy + 575), 18, WHITE, LINE, 2)
        txt(draw, (cx + 280, cy + 170), "Monthly starting balance", B15)
        for line_no, line in enumerate(wrap(draw, "Enter this month's new funds only. Positive unused money from earlier months is added automatically.", F11, cw - 590)):
            txt(draw, (cx + 280, cy + 225 + line_no * 35), line, F11, MUTED)
        txt(draw, (cx + 280, cy + 330), "Starting balance", F9, INK)
        rounded(draw, (cx + 280, cy + 365, cx + cw - 280, cy + 430), 8, PAPER, LINE)
        txt(draw, (cx + 305, cy + 398), "60000", F13, INK, "lm")
        pill(draw, cx + cw - 480, cy + 480, "Save balance", True, 200)
        return
    if scene == "expense":
        txt(draw, (cx, cy), "Recent expenses", B20)
        pill(draw, cx + cw - 190, cy - 5, "+ Add expense", True, 190)
        rows = [("Lunch with team", "Personal Buying", "14 Oct", "₹850"), ("Airport taxi", "Business Trip", "12 Oct", "₹1,400"), ("Metro pass", "Monthly Travelling", "01 Oct", "₹2,200")]
        rounded(draw, (cx, cy + 85, cx + cw, cy + 360), 14, WHITE, LINE)
        for i, row in enumerate(rows):
            ry = cy + 125 + i * 72
            txt(draw, (cx + 25, ry), row[0], B10)
            pill(draw, cx + 330, ry - 10, row[1], False, 190)
            txt(draw, (cx + 565, ry), row[2], F9, MUTED)
            txt(draw, (cx + cw - 35, ry), row[3], B10, INK, "ra")
        rounded(draw, (cx + 175, cy + 240, cx + cw - 175, cy + ch + 35), 18, WHITE, LINE, 2)
        txt(draw, (cx + 220, cy + 280), "Add an expense", B15)
        fields = [("Expense name", "Groceries"), ("Amount", "3250"), ("Date", "2026-10-17"), ("Category", "Personal Buying"), ("Details", "Weekly essentials")]
        for i, (label, value) in enumerate(fields):
            col, row = i % 2, i // 2
            fx, fy = cx + 220 + col * 370, cy + 340 + row * 105
            txt(draw, (fx, fy), label, F9, MUTED)
            rounded(draw, (fx, fy + 30, fx + 320, fy + 82), 7, PAPER, LINE)
            txt(draw, (fx + 15, fy + 56), value, F9, INK, "lm")
        pill(draw, cx + cw - 410, cy + ch - 25, "Save expense", True, 190)
        return
    if scene == "refund":
        txt(draw, (cx, cy), "Your reimbursements, in focus.", B20)
        txt(draw, (cx, cy + 54), "Track refundable costs and close the loop when money returns.", F11, MUTED)
        money_card(draw, cx, cy + 105, 330, "Awaiting reimbursement", "₹1,150", True, "1 pending")
        money_card(draw, cx + 350, cy + 105, 330, "Received this month", "₹3,700", False, "Added back once")
        rounded(draw, (cx, cy + 325, cx + cw, cy + 500), 14, WHITE, LINE)
        txt(draw, (cx + 30, cy + 365), "Client dinner", B12)
        pill(draw, cx + 315, cy + 347, "Reimbursable", False, 180)
        pill(draw, cx + 530, cy + 347, "Pending refund", False, 170)
        txt(draw, (cx + cw - 35, cy + 365), "₹1,150", B12, INK, "ra")
        draw.line((cx + 610, cy + 452, cx + 610, cy + 540), fill=GREEN, width=3)
        draw.polygon([(cx + 600, cy + 530), (cx + 620, cy + 530), (cx + 610, cy + 545)], fill=GREEN)
        pill(draw, cx + 520, cy + 565, "✓ Received", True, 180)
        return
    if scene == "month":
        txt(draw, (cx, cy), "October 2026", B20)
        pill(draw, cx, cy + 80, "‹", False, 55); pill(draw, cx + 70, cy + 80, "2026-10", False, 175); pill(draw, cx + 260, cy + 80, "›", False, 55)
        pill(draw, cx + cw - 440, cy + 80, "Export CSV", False, 180); pill(draw, cx + cw - 245, cy + 80, "Clear month…", True, 190)
        rounded(draw, (cx, cy + 170, cx + cw, cy + ch), 14, WHITE, LINE)
        txt(draw, (cx + 35, cy + 210), "Clear October 2026", B15)
        txt(draw, (cx + 35, cy + 265), "Choose exactly what to remove", F11, MUTED)
        options = [("Budget records", "8 expenses + starting balance"), ("Leave records", "2 leave entries"), ("Full backup", "Download before clearing")]
        for i, (title, note) in enumerate(options):
            oy = cy + 330 + i * 92
            draw.rectangle((cx + 40, oy, cx + 65, oy + 25), fill=SAGE, outline=GREEN, width=2)
            txt(draw, (cx + 90, oy), title, B10)
            txt(draw, (cx + 90, oy + 34), note, F9, MUTED)
        rounded(draw, (cx + cw - 500, cy + 330, cx + cw - 65, cy + 585), 12, "#fff7ee", "#ead8c0")
        txt(draw, (cx + cw - 465, cy + 365), "Safety confirmation", B12)
        txt(draw, (cx + cw - 465, cy + 420), "Type 2026-10 to continue", F9, MUTED)
        rounded(draw, (cx + cw - 465, cy + 465, cx + cw - 100, cy + 520), 7, WHITE, LINE)
        txt(draw, (cx + cw - 445, cy + 493), "2026-10", F11, INK, "lm")
        return
    if scene == "leaves":
        txt(draw, (cx, cy), "Leave balance", B20)
        txt(draw, (cx, cy + 55), "October 2026", F11, MUTED)
        card_w = (cw - 24) // 3
        money_card(draw, cx, cy + 100, card_w, "Casual leave", "4.5 days", True, "2 new + 2.5 carried")
        money_card(draw, cx + card_w + 12, cy + 100, card_w, "Medical leave", "3 days", False, "Manual monthly credit")
        money_card(draw, cx + (card_w + 12) * 2, cy + 100, card_w, "Comp-off", "1 day", False, "Unused days carry")
        pill(draw, cx, cy + 325, "Set monthly allowances", False, 245)
        pill(draw, cx + 265, cy + 325, "+ Add leave", True, 160)
        rounded(draw, (cx, cy + 395, cx + cw, cy + ch), 14, WHITE, LINE)
        rows = [("12 Oct", "Casual", "0.5 day", "Personal appointment"), ("20 Oct", "Medical", "1 day", "Recovery")]
        for i, row in enumerate(rows):
            ry = cy + 445 + i * 85
            txt(draw, (cx + 30, ry), row[0], B10); pill(draw, cx + 190, ry - 10, row[1], False, 130)
            txt(draw, (cx + 360, ry), row[2], F11); txt(draw, (cx + 545, ry), row[3], F11, MUTED)
        return
    if scene == "profile":
        overview(draw, cx, cy, cw, ch)
        rounded(draw, (cx + cw - 650, cy - 25, cx + cw + 25, cy + ch + 25), 18, WHITE, LINE, 2)
        txt(draw, (cx + cw - 610, cy + 25), "Your private Google workspace", B15)
        txt(draw, (cx + cw - 610, cy + 75), "you@example.com", F11, GREEN)
        txt(draw, (cx + cw - 610, cy + 115), "Saved to your Google Sheet", F9, MUTED)
        actions = ["Open my Google Sheet", "Load from Google", "Save to Google", "Download full backup", "Restore backup", "Log out"]
        for i, action in enumerate(actions):
            ax = cx + cw - 610 + (i % 2) * 285
            ay = cy + 180 + (i // 2) * 80
            pill(draw, ax, ay, action, i == 0, 260)
        rounded(draw, (cx + cw - 610, cy + 460, cx + cw - 40, cy + 620), 10, SAGE)
        txt(draw, (cx + cw - 580, cy + 495), "SYNC STATUS", F9, MUTED)
        txt(draw, (cx + cw - 580, cy + 540), "Private Sheet ready · Changes save automatically.", F9, INK)
        return
    if scene == "currency":
        txt(draw, (cx, cy), "Mini tools", B20)
        txt(draw, (cx, cy + 55), "Currency converter", F11, MUTED)
        rounded(draw, (cx, cy + 110, cx + cw, cy + ch), 14, WHITE, LINE)
        txt(draw, (cx + 35, cy + 150), "Convert with today's public rate", B15)
        fields = [("Amount", "10,000"), ("From", "INR · Indian Rupee"), ("To", "USD · US Dollar")]
        for i, (label, value) in enumerate(fields):
            fx = cx + 35 + i * (cw - 70) / 3
            txt(draw, (fx, cy + 225), label, F9, MUTED)
            rounded(draw, (fx, cy + 260, fx + (cw - 120) / 3, cy + 325), 7, PAPER, LINE)
            txt(draw, (fx + 15, cy + 292), value, F11, INK, "lm")
        rounded(draw, (cx + 35, cy + 380, cx + cw - 35, cy + 570), 12, SAGE)
        txt(draw, (cx + 70, cy + 420), "CONVERSION RESULT", F9, MUTED)
        txt(draw, (cx + 70, cy + 470), "$120.42", B28, GREEN)
        txt(draw, (cx + 70, cy + 535), "1 INR = 0.012042 USD · Rate updated daily", F9, MUTED)
        pill(draw, cx + cw - 230, cy + 605, "Refresh rate", True, 190)
        return
    if scene == "travel":
        txt(draw, (cx, cy), "Goa weekend", B20)
        txt(draw, (cx, cy + 55), "Train details · Hotel check-in at 2 PM", F11, MUTED)
        pill(draw, cx + cw - 170, cy - 5, "Edit plan", False, 160)
        gap = 22; col = (cw - gap) / 2
        lists = [("Packing", ["Passport", "Sunscreen", "Camera", "Charger"], 2), ("Tasks", ["Book hotel", "Confirm train", "Share itinerary"], 1)]
        for li, (title, items, done) in enumerate(lists):
            lx = cx + li * (col + gap)
            rounded(draw, (lx, cy + 110, lx + col, cy + ch), 14, WHITE, LINE)
            txt(draw, (lx + 30, cy + 150), title, B15)
            txt(draw, (lx + col - 30, cy + 155), f"{done}/{len(items)} complete", F9, MUTED, "ra")
            draw.rectangle((lx + 30, cy + 205, lx + col - 30, cy + 214), fill=SAGE)
            draw.rectangle((lx + 30, cy + 205, lx + 30 + (col - 60) * done / len(items), cy + 214), fill=GREEN)
            for i, item in enumerate(items):
                iy = cy + 265 + i * 74
                draw.ellipse((lx + 32, iy, lx + 58, iy + 26), fill=GREEN if i < done else WHITE, outline=GREEN, width=2)
                if i < done: txt(draw, (lx + 45, iy + 13), "✓", F9, WHITE, "mm")
                txt(draw, (lx + 78, iy + 13), item, F11, MUTED if i < done else INK, "lm")
            pill(draw, lx + 30, cy + ch - 65, "+ Add item", False, 145)


def draw_slide(scene, index):
    img = Image.new("RGB", (W, H), CREAM)
    draw = ImageDraw.Draw(img)
    # subtle decorative circles
    draw.ellipse((W - 370, -220, W + 160, 310), outline="#dfe3d8", width=2)
    draw.ellipse((-170, H - 300, 250, H + 120), outline="#dfe3d8", width=2)
    brand(draw, 70, 55)
    txt(draw, (W - 70, 57), f"{index + 1:02d}  /  {len(SCENES):02d}", F9, MUTED, "ra")
    txt(draw, (70, 155), scene["chapter"], B10, "#7e9274")
    title_lines = wrap(draw, scene["title"], B28, 250)
    for i, line in enumerate(title_lines):
        txt(draw, (70, 210 + i * 68), line, B28, INK)
    sub_y = 240 + len(title_lines) * 68
    for i, line in enumerate(wrap(draw, scene["subtitle"], F11, 245)):
        txt(draw, (70, sub_y + i * 38), line, F11, MUTED)
    draw.line((70, H - 215, 305, H - 215), fill="#a9b4a7", width=2)
    txt(draw, (70, H - 178), "IN THIS CHAPTER", F9, MUTED)
    summary = {
        "welcome": "What Pocket does and what this guide covers",
        "signin": "Private Google identity and Sheet-based sync",
        "overview": "The four totals and your spending picture",
        "balance": "New funds, carry-forward, and monthly setup",
        "expense": "Create, categorize, search, edit, and delete",
        "refund": "Pending money and received reimbursements",
        "month": "Month picker, CSV export, and safe clearing",
        "leaves": "Allowances, half days, and carry-forward",
        "profile": "Cloud sync, backup, restore, and logout",
        "currency": "Display preferences and live conversion",
        "travel": "Plans, notes, checklists, and progress",
        "finish": "A simple monthly routine and data control",
    }[scene["panel"]]
    for i, line in enumerate(wrap(draw, summary, F9, 230)):
        txt(draw, (70, H - 135 + i * 28), line, F9, INK)
    draw_panel(draw, scene["panel"], *app_shell(draw, scene["panel"]))
    return img


def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as source:
        return source.getnframes() / source.getframerate()


def make_music(path: Path, duration: float):
    rate = 44100
    count = int(rate * duration)
    t = np.arange(count, dtype=np.float64) / rate
    # Soft, unobtrusive three-note bed.
    tone = (
        np.sin(2 * math.pi * 174.61 * t)
        + 0.65 * np.sin(2 * math.pi * 220.00 * t)
        + 0.45 * np.sin(2 * math.pi * 261.63 * t)
    )
    envelope = np.minimum(1, t / 1.2) * np.minimum(1, (duration - t) / 1.2)
    samples = np.clip(tone * envelope * 460, -32767, 32767).astype("<i2")
    with wave.open(str(path), "wb") as out:
        out.setnchannels(1); out.setsampwidth(2); out.setframerate(rate); out.writeframes(samples.tobytes())


def run(command):
    subprocess.run([str(item) for item in command], check=True)


def main():
    BUILD.mkdir(parents=True, exist_ok=True)
    NARRATION_FILE.write_text(
        "POCKET — PROFESSIONAL HOW-TO VIDEO\n\n" + "\n\n".join(
            f"{i + 1:02d}. {scene['title']}\n{scene['narration']}" for i, scene in enumerate(SCENES)
        ), encoding="utf-8"
    )

    segments = []
    for index, scene in enumerate(SCENES):
        stem = f"scene-{index + 1:02d}"
        png = BUILD / f"{stem}.png"
        voice = BUILD / f"{stem}-voice.wav"
        music = BUILD / f"{stem}-music.wav"
        segment = BUILD / f"{stem}.mp4"
        draw_slide(scene, index).save(png, quality=96)
        run([PWSH, "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", VIDEO_DIR / "tts.ps1", "-Output", voice, "-Text", scene["narration"]])
        duration = wav_duration(voice) + 1.0
        make_music(music, duration)
        frames = max(1, math.ceil(duration * 24))
        fade_out = max(0, duration - 0.55)
        run([
            FFMPEG, "-y", "-loop", "1", "-i", png, "-i", voice, "-i", music,
            "-filter_complex",
            f"[0:v]scale=2000:1125,zoompan=z='min(zoom+0.00008,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=24,fade=t=in:st=0:d=0.45,fade=t=out:st={fade_out:.2f}:d=0.55,format=yuv420p[v];"
            f"[1:a]adelay=450|450,afade=t=in:st=0:d=0.25,apad=pad_dur=1[a1];[2:a]volume=0.14[a2];[a1][a2]amix=inputs=2:duration=longest:dropout_transition=0,afade=t=out:st={fade_out:.2f}:d=0.55,aresample=44100,asetpts=N/SR/TB[a]",
            "-map", "[v]", "-map", "[a]", "-t", f"{duration:.3f}", "-r", "24",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", segment,
        ])
        segments.append(segment)

    concat = BUILD / "concat.txt"
    concat.write_text("\n".join(f"file '{segment.as_posix()}'" for segment in segments), encoding="utf-8")
    run([FFMPEG, "-y", "-fflags", "+genpts", "-f", "concat", "-safe", "0", "-i", concat, "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "44100", "-movflags", "+faststart", OUTPUT])
    print(OUTPUT)


if __name__ == "__main__":
    main()
