import { ItemDeletionDialog } from "../../apps/item-deletion-dialog.js"
import { ItemSFRPG } from "../../item/item.js"
import { ItemSheetSFRPG } from "../../item/sheet.js"
import { ActorSheetSFRPG } from "./base.js"
import { RPC } from "../../rpc.js"
import { SFRPG } from "../../config.js";

export class ActorSheetSFRPGLoot extends ActorSheetSFRPG {
    constructor(...args) {
        super(...args);

        this.acceptedItemTypes = [
            ...SFRPG.characterDefinitionItemTypes,
            ...SFRPG.physicalItemTypes
        ];

        this._tooltips = null;
    }

    static get defaultOptions() {
        const defaultOptions = super.defaultOptions;
        return mergeObject(defaultOptions, {
            classes: defaultOptions.classes.concat(['sfrpg', 'actor', 'sheet', 'npc']),
            height: 720,
            width: 720,
            template: "systems/sfrpg/templates/apps/item-collection-sheet.html",
            closeOnSubmit: false,
            submitOnClose: true,
            submitOnChange: true,
            resizable: true,
            dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
        });
    }

    async close(options={}) {

        if (this._tooltips !== null) {
            for (const tooltip of this._tooltips) {
                tooltip.destroy();
            }

            this._tooltips = null;
        }

        return super.close(options);
    }

    _prepareItems(data) {
        const items = [...this.actor.items.values()];
        return items;
    }

    activateListeners(html) {
        //super.activateListeners(html);

        html.find('.item .item-name h4').click(event => this._onItemSummary(event));

        if (game.user.isGM || this.document.isOwner) {
            html.find('img[data-edit]').click(ev => this._onEditImage(ev));
            html.find('#toggle-locked').click(this._toggleLocked.bind(this));
            html.find('#toggle-delete-if-empty').click(this._toggleDeleteIfEmpty.bind(this));

            html.find('.item-edit').click(ev => this._onItemEdit(ev));
            html.find('.item-delete').click(ev => this._onItemDelete(ev));
        }
    }

    /**
     * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
     */
    getData() {
        console.log(this)
        const isOwner = this.document.isOwner;
        const data = super.getData();
        data.actor = this.actor;
        data.system = duplicate(this.actor.system),
        data.config = CONFIG.SFRPG;
        data.isCharacter = true;
        data.isOwner = isOwner || game.user.isGM;
        data.isGM = game.user.isGM;
        data.labels = this.actor.labels || {};

        const items = [...this.actor.items.values()];

        for (const item of items) {
            item.img = item.img || CONST.DEFAULT_TOKEN;

            item.config = {
                isStack: item.system.quantity ? item.system.quantity > 1 : false,
                isOpen: item.type === "container" ? item.system.container.isOpen : true,
                isOnCooldown: item.system.recharge && !!item.system.recharge.value && (item.system.recharge.charged === false),
                hasUses: item.canBeUsed(),
                isCharged: !item.hasUses || item.getRemainingUses() <= 0 || !item.isOnCooldown,
                hasCapacity: item.hasCapacity(),
            };

            if (item.config.hasCapacity) {
                item.config.capacityCurrent = item.getCurrentCapacity();
                item.config.capacityMaximum = item.getMaxCapacity();
            }

            item.system.quantity = item.system.quantity || 0;
            item.system.price = item.system.price || 0;
            item.system.bulk = item.system.bulk || "-";

            let weight = 0;
            if (item.system.bulk === "L") {
                weight = 0.1;
            } else if (item.system.bulk === "-") {
                weight = 0;
            } else {
                weight = parseFloat(item.system.bulk);
            }

            item.system.totalWeight = item.system.quantity * weight;
            if (item.system.equippedBulkMultiplier !== undefined && item.system.equipped) {
                item.system.totalWeight *= item.system.equippedBulkMultiplier;
            }

            if (item.system.totalWeight < 1 && item.system.totalWeight > 0) {
                item.system.totalWeight = "L"
            } else if (item.system.totalWeight === 0) {
                item.system.totalWeight = "-"
            } else {
                item.system.totalWeight = Math.floor(item.system.totalWeight);
            }
            

        }

        data.items = [];
    
        this.processItemContainment(items, function (itemType, itemData) {
            data.items.push(itemData);
        });
        
        data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        // Ensure containers are always open in loot collection tokens
        for(const itemData of data.items) {
            if (itemData.contents && itemData.contents.length > 0) {
                itemData.item.isOpen = true;
            }
        }

        //data.itemCollection = tokenData;

        /* if (data.itemCollection.locked && !game.user.isGM) {
            this.close();
        } */

        return data;
    }

    processItemContainment(items, pushItemFn) {
        const preprocessedItems = [];
        const containedItems = [];
        for (const item of items) {
            const itemData = {
                item: item,
                parent: items.find(x => x.system.container?.contents && x.system.container.contents.find(y => y.id === item._id)),
                contents: []
            };
            preprocessedItems.push(itemData);

            if (!itemData.parent) {
                pushItemFn(item.type, itemData);
            } else {
                containedItems.push(itemData);
            }
        }

        for (const item of containedItems) {
            const parent = preprocessedItems.find(x => x.item._id === item.parent._id);
            if (parent) {
                parent.contents.push(item);
            }
        }
    }

    async _render(...args) {
        await super._render(...args);

        if (this._tooltips === null) {
            this._tooltips = tippy.delegate(`#${this.id}`, {
                target: '[data-tippy-content]',
                allowHTML: true,
                arrow: false,
                placement: 'top-start',
                duration: [500, null],
                delay: [800, null]
            });
        }
    }

    getChatData(itemData, htmlOptions) {
        console.log(itemData);
        const data = duplicate(itemData);
        const labels = itemData.labels || {};

        if (htmlOptions.async === undefined) htmlOptions.async = false;

        // Rich text description
        data.system.description.value = TextEditor.enrichHTML(data.system.description.value, htmlOptions);

        // Item type specific properties
        const props = [];
        const fn = itemData[`_${itemData.type}ChatData`];
        if (fn) fn.bind(itemData)(data, labels, props);

        // General equipment properties
        if (data.hasOwnProperty("equipped") && !["goods", "augmentation", "technological", "upgrade"].includes(itemData.type)) {
            props.push(
                data.equipped ? "Equipped" : "Not Equipped",
                data.proficient ? "Proficient" : "Not Proficient",
            );
        }

        // Ability activation properties
        if (data.hasOwnProperty("activation")) {
            props.push(
                labels.target,
                labels.area,
                labels.activation,
                labels.range,
                labels.duration
            );
        }

        if (data.hasOwnProperty("capacity")) {
            props.push(
                labels.capacity
            );
        }

        // Filter properties and return
        data.properties = props.filter(p => !!p && !!p.name);
        return data;
    }

    /* -------------------
        Event listener functions
       ------------------- */

    async _toggleLocked(event) {
        event.preventDefault();

        await this.actor.update({
            "system.locked": !this.actor.system.locked
        });
        console.log(this.actor.system.locked)
    }

    async _toggleDeleteIfEmpty(event) {
        event.preventDefault();

        await this.actor.update({
            "system.deleteIfEmpty": !this.actor.system.deleteIfEmpty
        });
    }

    _onItemEdit(event) {
        if (!this._canEdit()) {
            ui.notifications.error(`${this.actor.name} is locked.`)
            return;
        }

        const itemId = $(event.currentTarget).parents('.item').attr("data-item-id");
        const itemData = this.actor.items.find(x => x._id === itemId);

        const item = new ItemSFRPG(itemData);
        const sheet = new ItemSheetSFRPG(item);
        sheet.options.submitOnChange = false;
        sheet.options.submitOnClose = false;
        sheet.options.editable = true;
        sheet.render(true);
    }

    _onItemDelete(event) {
        event.preventDefault();

        if (!this._canEdit()) {
            ui.notifications.error(`${this.actor.name} is locked.`)
            return;
        }

        // TODO: Confirm dialog, and ask to recursively delete nested items, if it is the last item and deleteIfEmpty is enabled, also ask

        let li = $(event.currentTarget).parents(".item");
        let itemId = li.attr("data-item-id");

        const itemToDelete = this.actor.items.find(x => x._id === itemId);
        let containsItems = (itemToDelete.system.container?.contents && itemToDelete.system.container.contents.length > 0);
        ItemDeletionDialog.show(itemToDelete.name, containsItems, (recursive) => {
            this._deleteItemById(itemId, recursive);
            li.slideUp(200, () => this.render(false));
        });
    }


     _onEditImage(event) {
        const attr = event.currentTarget.dataset.edit;
        const current = getProperty(this.document, attr);
        new FilePicker({
          type: "image",
          current: current,
          callback: path => {
            event.currentTarget.src = path;
            this._onSubmit(event);
          },
          top: this.position.top + 40,
          left: this.position.left + 10
        }).browse(current);
      }

      _onItemSummary(event) {
        event.preventDefault();
        let li = $(event.currentTarget).parents('.item');
        let itemId = li.attr("data-item-id");
        const item = this.itemCollection.flags.sfrpg.itemCollection.items.find(x => x._id === itemId);
        let chatData = this.getChatData(item, { secrets: true, rollData: item.system });

        if (li.hasClass('expanded')) {
            let summary = li.children('.item-summary');
            summary.slideUp(200, () => summary.remove());
        } else {
            let div = $(`<div class="item-summary">${chatData.system.description.value}</div>`);
            let props = $(`<div class="item-properties"></div>`);
            chatData.properties.forEach(p => props.append(`<span class="tag" ${ p.tooltip ? ("data-tippy-content='" + p.tooltip + "'") : ""}>${p.name}</span>`));

            div.append(props);
            li.append(div.hide());
            div.slideDown(200, function() { /* noop */ });
        }
        li.toggleClass('expanded');
    }

    /* -----------------*/

    /* -----------------
      Helpers
      ------------------ */

    _deleteItemById(itemId, recursive = false) {
        let itemsToDelete = [itemId];

        if (recursive) {
            let itemsToTest = [itemId];
            while (itemsToTest.length > 0) {
                let itemIdToTest = itemsToTest.shift();
                let itemData = this.actor.items.find(x => x._id === itemIdToTest);
                if (itemData.system.container?.contents) {
                    for (let content of itemData.system.container.contents) {
                        itemsToDelete.push(content.id);
                        itemsToTest.push(content.id);
                    }
                }
            }
        }

        const newItems = this.actor.items.filter(x => !itemsToDelete.includes(x._id));
        const update = {
            "items": newItems
        }

        if (newItems.length === 0 && this.actor.system.deleteIfEmpty) {
            this.actor.delete();
        } else {
            this.actor.update(update);
        }
    }

    findItem(itemId) {
        return this.actor.items.find(x => x._id === itemId);
    }

    /** @override */
    _canEdit() {
        return !this.actor.system.locked || game.user.isGM;
      }
    
    

    /* -------------------------------------------- */

    /* -------------------------------------------- */
    /*  Drag and Drop                               */
    /* -------------------------------------------- */
  
    /** @override */
    _onDragStart(event) {
        const li = event.currentTarget;
        const actor = this.actor;
        const actorData = this.actor.system;

        if (!this._canEdit()) {
            ui.notifications.error(`${actor.name} is locked.`)
            return;
        }

        const item = actor.items.find(x => x._id === li.dataset.itemId);
        let draggedItems = [item];
        for (let i = 0; i<draggedItems.length; i++) {
            const draggedItemData = draggedItems[i];

            if (draggedItemData.container?.contents) {
                let newContents = [];
                for (let content of draggedItemData.container.contents) {
                    let contentItem = actor.items.find(x => x._id === content.id);
                    if (contentItem) {
                        draggedItems.push(contentItem);
                        newContents.push({id: contentItem.id, index: content.index});
                    }
                }
                draggedItemData.container.contents = newContents;
            }
        }

        const dragData = {
            type: draggedItems[0].type,
            items: draggedItems,
            uuid: draggedItems[0].uuid
        };
        console.log(dragData)
        event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    }

    /** @override */
    async _onDrop(event) {
        if (!this._canEdit()) {
            ui.notifications.error(`${this.actor.name} is locked.`)
            return;
        }

        super._onDrop(event)
        
        //Ensure items leaving the actor are deleted.
        let data = TextEditor.getDragEventData(event);

        if (data.type !== "Item") return;
        const item = await Item.fromDropData(data);

        Item.deleteEmbeddedDocuments("Item", [item.id])
    /*
        let targetContainer = null;
        if (event) {
            const targetId = $(event.target).parents('.item').attr('data-item-id')
            targetContainer = this.findItem(targetId);
        }

        if (!this.acceptedItemTypes.includes(item.type)) {
            // Reject item
            ui.notifications.error(game.i18n.format("SFRPG.InvalidItem", { name: SFRPG.itemTypes[item.type], target: SFRPG.actorTypes[this.actor.type] }));
            return;
        }

        console.log(item)
        this.actor.createEmbeddedDocuments("Item", [duplicate(item)])

         const sourceActorId = item.parent?._id;
        let sourceTokenId = null;
        let sourceSceneId = null;

        if (item.parent?.isToken) {
            sourceTokenId = item.parent.parent._id;
            sourceSceneId = item.parent.parent.parent._id;
        }

        const msg = {
            target: {
                actorId: this.actor.id,
                tokenId: this.actor.token?.id,
                sceneId: this.actor.token?.parent?.id
            },
            source: {
                actorId: sourceActorId,
                tokenId: sourceTokenId,
                sceneId: sourceSceneId,
            },
            draggedItemId: item.id,
            draggedItemData: item,
            pack: item.pack,
            containerId: targetContainer ? targetContainer.id : null
        }

        RPC.sendMessageTo("gm", "dragItemToCollection", msg); */
    } 
}