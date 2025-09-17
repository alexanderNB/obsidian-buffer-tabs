import { group } from 'console';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, Platform, WorkspaceLeaf, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
    bufferGroups: [boolean, string, string, string, number][]; // array of name, tag, buffer group, priority
}

interface lastOpenedOfGroups {
    buffers: TFile[][];
    group: number;
}


const DEFAULT_SETTINGS: MyPluginSettings = {
    bufferGroups: []
}

const DEFAULT_LAST_OPENED: lastOpenedOfGroups = {
    buffers: [],
    group: 0
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;
    lastOpened: lastOpenedOfGroups;
    bufferGroups: TFile[][] = [];
    activeFileIndex: number;
    activeGroupIndex: number;
    cycling: boolean = false;


    async onload() {
        await this.loadSettings();
        await this.loadLastOpened();

        for (let i = 0; i < this.settings.bufferGroups.length; i++) {
            this.bufferGroups.push([])
            this.addCommand({
                id: `goto-buffer-group${i + 1}`,
                name: `Goto buffer group ${i + 1}`,

                checkCallback: (checking: boolean) => {
                    if (this.activeGroupIndex == i || this.bufferGroups[i].length == 0)
                        return false;
                    if (checking)
                        return true;
                    this.activeGroupIndex = i;
                    this.activeFileIndex = this.bufferGroups[i].length - 1;
                    this.app.workspace.getLeaf().openFile(this.bufferGroups[this.activeGroupIndex][this.activeFileIndex]);
                },

            });
        }
        if (this.bufferGroups.length == this.lastOpened.buffers.length) {
            this.bufferGroups = this.lastOpened.buffers;
        }

        // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Status Bar Text');

        // This adds a simple command that can be triggered anywhere
        this.addCommand({
            id: "log-buffers",
            name: "log things",
            checkCallback: (checking: boolean) => {
                if (checking) {
                    return true;
                }
                console.log(this.bufferGroups)
            }
        });

        this.addCommand({
            id: "go-to-previous-buffer",
            name: "Go to previous buffer",
            checkCallback: (checking: boolean) => {
                if (this.activeFileIndex == 0) {
                    return false;
                }
                if (checking) {
                    return true;
                }
                this.cycling = true;
                this.activeFileIndex--;
                this.app.workspace.getLeaf().openFile(this.bufferGroups[this.activeGroupIndex][this.activeFileIndex]);


            }
        });
        this.addCommand({
            id: "go-to-next-buffer",
            name: "Go to next buffer",
            checkCallback: (checking: boolean) => {
                if (this.activeFileIndex >= this.bufferGroups[this.activeGroupIndex].length - 1) {
                    return false;
                }
                if (checking) {
                    return true;
                }
                this.cycling = true;
                this.activeFileIndex++;
                this.app.workspace.getLeaf().openFile(this.bufferGroups[this.activeGroupIndex][this.activeFileIndex]);

            }
        });
        this.addCommand({
            id: "go-to-previous-buffer-group",
            name: "Go to previous buffer group",
            checkCallback: (checking: boolean) => {
                if (this.activeGroupIndex == 0) {
                    return false;
                }
                if (checking) {
                    return true;
                }
                this.cycling = true;
                this.activeGroupIndex--;
                this.app.workspace.getLeaf().openFile(this.bufferGroups[this.activeGroupIndex][this.activeFileIndex]);


            }
        });
        this.addCommand({
            id: "go-to-next-buffer-group",
            name: "Go to next buffer group",
            checkCallback: (checking: boolean) => {
                if (this.activeGroupIndex >= this.bufferGroups.length - 1) {
                    return false;
                }
                if (checking) {
                    return true;
                }
                this.cycling = true;
                this.activeGroupIndex++;
                this.app.workspace.getLeaf().openFile(this.bufferGroups[this.activeGroupIndex][this.activeFileIndex]);
            }
        });

        this.addCommand({
            id: "log-settings",
            name: "log the settings",
            checkCallback: (checking: boolean) => {
                if (checking) {
                    return true;
                }
                console.log(this.settings.bufferGroups);
                console.log(this.lastOpened.buffers);
            }
        });


        // This adds a settings tab so the user can configure various aspects of the plugin
        this.addSettingTab(new SampleSettingTab(this.app, this));


        this.registerEvent(this.app.workspace.on("file-open", (file: TFile | null) => {



            if (this.cycling) {
                this.cycling = false;
                return;
            }
            if (!file) {
                return;
            }
            let bestMatch = null;
            let currentPriority = -Math.min();
            let counter = -1;
            for (let bufferGroup of this.settings.bufferGroups) {
                counter++;
                if (bufferGroup[0]) {
                    if (bestMatch == null) {
                        bestMatch = counter;
                    }
                    continue;
                }

                if (bufferGroup[1]) {
                    const fileNameRegex: RegExp = new RegExp(bufferGroup[1], "g");
                    if (!fileNameRegex.test(file.name)) continue;
                }

                let metadata = this.app.metadataCache.getFileCache(file);
                if (bufferGroup[2]) {
                    let foundTag = false;
                    if (metadata?.frontmatter?.tags) {
                        if (metadata.frontmatter.tags.contains(bufferGroup[2]))
                            foundTag = true;
                    }
                    if (metadata?.tags) {
                        for (let tag of metadata.tags) {
                            if (tag.tag.substring(1) == bufferGroup[2])
                                foundTag = true;
                        }
                    }
                    if (!foundTag) continue;
                }

                if (bufferGroup[3]) {
                    if (metadata?.frontmatter) {
                        if (!metadata.frontmatter["buffergroup"].toString().contains(bufferGroup[2])) continue;
                    }
                    else {
                        continue;
                    }
                }
                if (currentPriority >= bufferGroup[4]) continue;
                currentPriority = bufferGroup[4];
                bestMatch = counter;
            }
            if (bestMatch == null) {
                console.error("No buffer group found")
                return;
            }

            let bufferGroup: TFile[] = this.bufferGroups[bestMatch];
            if (bufferGroup.contains(file)) {
                bufferGroup.remove(file)
            }
            bufferGroup.push(file)
            this.activeFileIndex = bufferGroup.length - 1;
            this.activeGroupIndex = bestMatch;
        }));
    }

    onunload() {
        this.lastOpened.buffers = [];

        for (let bufferGroup of this.bufferGroups) {
            this.lastOpened.buffers.push([])
            if (bufferGroup.length > 0) {
                this.lastOpened.buffers[-1].push(bufferGroup[-1])
            }

        }
        this.lastOpened.buffers[this.activeGroupIndex] = [this.bufferGroups[this.activeGroupIndex][this.activeFileIndex]];
        this.lastOpened.group = this.activeGroupIndex;
        this.saveLastOpened()
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
        console.log(await this.loadData())
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async loadLastOpened() {
        this.lastOpened = Object.assign({}, DEFAULT_LAST_OPENED, await this.loadData());
        console.log(await this.loadData(), "this one")

    }
    async saveLastOpened() {
        await this.saveData(this.lastOpened);
    }
}

class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;

    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Add/remove buffer group")
            .setDesc("buffer groupppp")
            .addButton((button) => {
                button.setButtonText("Add");
                button.onClick(() => {
                    this.plugin.settings.bufferGroups.push([false, "", "", "", 0]);
                    this.plugin.saveSettings();
                    this.display()
                });
            })
            .addButton((button) => {
                button.setButtonText("Remove last");
                button.onClick(() => {
                    this.plugin.settings.bufferGroups.pop();
                    this.plugin.saveSettings();
                    this.display()
                });
            });
        let counter = 0;
        for (let element of this.plugin.settings.bufferGroups) {
            counter++;
            let setting = new Setting(containerEl)
                .setName(`Buffer group ${counter}`)
                .setDesc("Buffer group with the following criteria");
            if (element[0]) {
                setting.setDesc("Default buffer group")
                continue;
            }
            setting
                .addButton(button => button
                    .setButtonText("Make default")
                    .onClick(() => {
                        this.plugin.settings.bufferGroups.forEach(element2 => {
                            element2[0] = false;
                        })
                        element[0] = true;
                        this.plugin.saveSettings();
                        this.display();
                    })
                )
                .addText(text => text
                    .setPlaceholder("File name")
                    .setValue(element[1])
                    .onChange(async value => {
                        element[1] = value;
                        await this.plugin.saveSettings();
                    })
                )
                .addText(text => text
                    .setPlaceholder("Tags")
                    .setValue(element[2])
                    .onChange(async value => {
                        element[2] = value;
                        await this.plugin.saveSettings();
                    })
                )
                .addText(text => text
                    .setPlaceholder("buffer group")
                    .setValue(element[3])
                    .onChange(async value => {
                        element[3] = value;
                        await this.plugin.saveSettings();
                    })
                )
                .addText(text => text
                    .setPlaceholder("Priority")
                    .setValue(`${element[4]}`)
                    .onChange(async value => {
                        let parsedValue = Number.parseInt(value);
                        if (parsedValue) {
                            element[4] = parsedValue;
                            await this.plugin.saveSettings();
                        }
                    })
                )

        };
    }
}
