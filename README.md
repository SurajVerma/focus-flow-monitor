# Focus Flow Monitor

**Track your time online, gain insights, control distractions, and stay productive with this privacy-focused Firefox extension.**

[![License: MPL 2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Mozilla Add-on](https://img.shields.io/amo/v/focusflow-monitor?label=Firefox%20Add-on&color=007bff)](https://addons.mozilla.org/en-US/firefox/addon/focusflow-monitor/)
[![GitHub last commit](https://img.shields.io/github/last-commit/SurajVerma/focus-flow-monitor)](https://github.com/SurajVerma/focus-flow-monitor/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/SurajVerma/focus-flow-monitor)](https://github.com/SurajVerma/focus-flow-monitor/issues)
[![GitHub Stars](https://img.shields.io/github/stars/SurajVerma/focus-flow-monitor?style=social)](https://github.com/SurajVerma/focus-flow-monitor/stargazers)

Focus Flow Monitor helps you understand your online habits by tracking the time you spend on different websites. Gain insights through categorized statistics, visual charts, and a daily focus score. Set limits, schedule blocks, or permanently block distracting sites to stay productive. All your data stays local, prioritizing your privacy.

![Quick View Popup](https://github.com/user-attachments/assets/0d307deb-52a1-4766-8ed2-fbde297cb331)


---

## ✨ What's New in Version 0.8.4 ✨

* **🍅 Introducing Tomato Clock (Pomodoro Timer):**

We're excited to announce a brand-new addition to **Focus Flow Monitor** designed to boost your productivity even further: the **Tomato Clock**!

Many of you know this technique as the Pomodoro Timer – a proven time management method that breaks down work into focused intervals, traditionally 25 minutes in length, separated by short breaks. Our integrated Tomato Clock brings this power directly into your workflow.

### What you can do with the new Tomato Clock:

* **Stay Focused:** Work in timed sessions (defaulting to 25 minutes) to maintain high concentration.
* **Take Regular Breaks:** Reminds you to take short breaks (5 minutes) and longer breaks (15 minutes) to rest and recharge.
* **Classic Pomodoro Flow:** Follows the standard cycle: Work -> Short Break -> Work -> Short Break -> Work -> Short Break -> Work -> Long Break.
* **Easy Controls:** Start, pause, reset the current timer, or switch to the next phase directly from the popup.
* **Visual Cues:** The current phase and remaining time are clearly displayed in the popup. The extension icon badge also updates dynamically to show the active timer and its current phase color.
* **Desktop Notifications:** Get notified when a work session or break is complete, so you know when it's time to switch gears. You can easily toggle these notifications on or off from the popup.

### How to use it:

1.  Click on the Focus Flow Monitor icon in your browser toolbar.
2.  You'll find the "Tomato Clock" section right in the popup.
3.  Click "Start" to begin your first work session!

We believe this feature will be a great companion to the existing time tracking and site blocking capabilities, helping you manage not just *where* you spend your time, but *how* effectively you use it.

Give the new Tomato Clock a try and let us know what you think! Your feedback is always welcome.

For more details on this and previous updates, check out the [Releases Page](https://github.com/SurajVerma/focus-flow-monitor/releases).

---

## Key Features

-   **Automatic Time Tracking:** Monitors time spent on websites in your active browser tab. Pauses tracking during inactivity (configurable duration).
-   **Website Categorization:** Automatically assigns websites to predefined or custom categories (e.g., Work, Social Media, Entertainment).
    -   Easily edit existing categories and domain assignments (wildcards supported).
-   **Detailed Statistics:** View comprehensive reports of time spent per website and category for various periods (Today, This Week, This Month, All Time).
-   **Visual Charts:**
    -   Doughnut chart for an intuitive visual breakdown of time by site or category on the statistics page.
    -   Hourly activity bar chart in the popup for a quick daily overview.
-   **Interactive Calendar View:** Explore daily time totals and top websites. Clicking any date updates all statistic displays (Category List, Website List, Focus Score, Chart) for that selected day.
-   **Focus Score:** Rate your website categories (e.g., Productive, Neutral, Distracting) to generate a daily focus score, helping you gauge your productivity at a glance.
-   **Site Blocking & Limiting:**
    -   Set daily time limits for specific websites or entire categories.
    -   Permanently block access to distracting websites.
    -   **NEW: Scheduled Blocking** – Define specific days and times for your block rules to be active.
-   **Customizable Block Page:** Personalize the experience when a site is blocked with custom messages, motivational quotes, and control over displayed information.
-   **Data Management:**
    -   Export your complete tracking history and settings for backup.
    -   Import previously exported data to restore your setup.
    -   **Data Retention Settings:** Set a custom duration for how long tracking data is stored.
-   **Theme Support:** Automatically matches your browser or operating system's light or dark theme.
-   **Privacy Focused:** All your tracking data is stored locally within your browser. No data is ever sent to external servers.

---

## Privacy

**Privacy-first by design.**

Focus Flow Monitor does not employ any external tracking or analytics. Your Browse and time data stays local, stored entirely within your browser's storage, and is never transmitted elsewhere. You have full control over your data, including options to export it, clear it, and set data retention periods.

---

## Installation

Get the latest version from the official Firefox Add-ons page:

[**Install Focus Flow Monitor for Firefox**](https://addons.mozilla.org/en-US/firefox/addon/focusflow-monitor/)

---

## Usage Notes

-   **Tracking Inactivity:** To accurately capture activities like video watching or reading, tracking pauses only when you're inactive (no mouse or keyboard input) for a duration you can configure (default is 30 minutes; options range from 1 minute to 1 hour, or can be disabled).
-   **Accessing Options Page:** You can access detailed statistics, manage categories, set site rules (including schedules and block page customization), and configure all settings via the extension's options page.
    -   Right-click the extension icon in the Firefox toolbar → "Manage Extension" → "Preferences/Options" (⚙️ icon).
    -   Alternatively, click the gear (⚙️) icon in the extension popup.
-   **How to use 🍅 Tomato Clock:**
    -    Click on the Focus Flow Monitor icon in your browser toolbar.
    -    You'll find the "Tomato Clock" section right in the popup.
    -    Click "Start" to begin your first work session!
    -    A Pomodoro cycle consists of 4 work sessions, with a short break after each of the first 3 sessions, followed by a long break at the end. The timer will automatically guide you to the next stage—for example, after completing a work session, it will prompt you to start the short break. However, you're free to manually switch between timers if you prefer.
    -    The remaining time will appear in the toolbar if the extension is pinned: ![image](https://github.com/user-attachments/assets/64ac383c-0406-4b57-b7ed-da80108d9b83). If you want **Focus Flow Monitor** to notify you when the timer ends, the extension will need notification permissions. You can grant this by clicking the bell icon in the popup which will take you to Tomato Clock settings on the Options page.

-   **Active Development:** Focus Flow Monitor is actively maintained and improved. Feedback and suggestions are always welcome!

---

## Screenshots

**Options & Statistics Page:**
![Options Page](https://github.com/user-attachments/assets/387e0515-d242-44f5-9e64-03c74b12a2ca)

**Blocked Page Example:**
![Blocked Page](https://github.com/user-attachments/assets/01c6ba2b-595c-41a1-943b-15ed34228b61)

*(Consider adding new screenshots for Scheduled Blocking setup and the Customized Block Page features!)*

---

## Contributing

We welcome contributions from the community! Whether it's reporting a bug, suggesting a new feature, or writing code, your help is appreciated.

-   **Report Issues or Suggest Features:** Please use the [GitHub Issues](https://github.com/SurajVerma/focus-flow-monitor/issues) page.
-   **Contribute Code:**
    1.  Fork the repository.
    2.  Create a new branch for your feature or bug fix (`git checkout -b feature/your-amazing-feature` or `fix/issue-number`).
    3.  Make your changes and commit them with clear messages.
    4.  Push your branch to your fork (`git push origin feature/your-amazing-feature`).
    5.  Open a Pull Request against the `main` (or relevant development) branch of this repository.

### Development Setup

1.  Clone the repository:
    ```bash
    git clone [https://github.com/SurajVerma/focus-flow-monitor.git](https://github.com/SurajVerma/focus-flow-monitor.git)
    cd focus-flow-monitor
    ```
2.  Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3.  Click on "Load Temporary Add-on...".
4.  Browse to the directory where you cloned the repository and select the `manifest.json` file.
5.  The extension will now be loaded. To see changes you make to the code, you'll typically need to reload the extension from the `about:debugging` page (using the "Reload" button for the extension).

---

## License

This project is licensed under the **Mozilla Public License Version 2.0**.

You can view the full license text in the [LICENSE](LICENSE) file.

_In simple terms, this means you are free to use, modify, and distribute the software, but if you modify files licensed under MPL 2.0, you must make your modifications available under the same MPL 2.0 license. Please ensure you retain the original copyright and license notices._

---

_Created with ❤️ in India by Suraj_
