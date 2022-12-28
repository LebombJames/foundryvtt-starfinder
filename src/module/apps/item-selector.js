/**
 * A specialized form used to select damage or condition types which appl to an Actor
 *
 * @type {FormApplication}
 */
export class ItemSelectorSFRPG extends FormApplication {
    static get defaultOptions() {
        const options = super.defaultOptions;

        options.id = "item-selector";
        options.classes = ["sfrpg"];
        options.title = "Item Selection";
        options.template = "systems/sfrpg/templates/apps/item-selector.html";
        options.width = 500;
        options.height = "auto";

        return options;
    }

    /**
     * Provide data to the HTML template for rendering
     *
     * @returns {Object}
     */
    async getData() {
        const items = duplicate(this.options.items);
        this.grantAll = this.options.items?.length === this.options.amountToSelect;
        this.availableItems = [];
        for (const item of items) {
            // Get item from pack
            const uuid = item.uuid;
            const packId = item.pack;
            const itemId = item.id;
            let document = null;

            if (uuid) {
                document = await fromUuid(uuid);
            } else {
                const pack = game.packs.get(packId);
                if (pack) {
                    await pack.getIndex();
                    document = await pack.getDocument(itemId);
                } else {
                    ui.notifications.warn(`Starfinder | Item or Pack ID on ${this.options.sourceItem.name} ${item.name ? `(${item.name}) ` : ""}select_item event is invalid.`);
                }
            }

            if (document) {
                this.availableItems.push({
                    item: duplicate(document),
                    selected: this.grantAll
                });
            }

        }

        return {
            sourceItem: this.options.sourceItem,
            targetActor: this.options.targetActor,
            availableItems: this.availableItems,
            amountToSelect: this.options.amountToSelect,
            grantAll: this.grantAll
        };
    }

    /**
     * Update the Actor object with new trait data processed from the form
     *
     * @param {Event} event The event that triggers the update
     * @param {Object} selectedItems Array of booleans indicating which item has been selected
     * @private
     */
    async _updateObject(event, selectedItems) {
        const itemsToCreate = [];
        for (let itemIndex = 0; itemIndex < this.availableItems.length; itemIndex++) {
            const item = this.availableItems[itemIndex];
            const isSelected = this.grantAll || selectedItems[itemIndex];
            if (isSelected) {
                // Add item to actor
                const itemData = item.item;

                // Clean up keys we do not want.
                delete itemData._id;
                delete itemData.effects;
                delete itemData.permission;
                delete itemData.sort;
                delete itemData.folder;

                itemsToCreate.push(itemData);
            }
        }

        if (itemsToCreate.length > 0) {
            const options = this.options;
            await options.targetActor?.createEmbeddedDocuments("Item", itemsToCreate);// .then((updateActorResult) => {

            const events = duplicate(options.sourceItem.system.events);
            events[options.eventIndex].state = 2;
            await options.sourceItem.update({"system.events": events});
        }
    }

    async close(options = {}) {
        this?.onClose();

        // Close the application itself
        return super.close(options);
    }

}
