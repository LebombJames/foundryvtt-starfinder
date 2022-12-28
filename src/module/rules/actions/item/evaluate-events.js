import { DiceSFRPG } from "../../../dice.js";
import RollContext from "../../../rolls/rollcontext.js";
import RollNode from "../../../rolls/rollnode.js";

export default function(engine) {
    engine.closures.add("evaluateEvents", (fact, context) => {
        const item = fact.item;
        const itemData = fact.itemData;

        const actor = fact.owner.actor;
        const actorData = fact.owner.actorData;

        // Tests if the trigger condition is met
        const evaluateTrigger = (trigger, item, actor) => {
            const itemData = item.system;
            const actorData = actor.system;

            if (trigger.type === "attribute_trigger") {
                const attribute = trigger.arg0;
                const operator = trigger.arg1;
                const comparedValue = trigger.arg2;

                const rollContext = new RollContext();
                rollContext.addContext("item", item);
                rollContext.setMainContext("item");
                if (actor) {
                    rollContext.addContext("owner", actor);
                    rollContext.setMainContext("owner");
                }

                const [attributeContext, remainingVariable] = RollNode.getContextForVariable(attribute, rollContext);
                const attributeValue = RollNode._readValue(attributeContext?.data, remainingVariable);

                // Conditions will use == instead of === because there's no type guarantee.
                // This unfortunately means false, 0, and null are all the same. Currently, no reason to see problems here.
                if (operator === "==") {
                    return (attributeValue == comparedValue);
                } else if (operator === "!=") {
                    return (attributeValue != comparedValue);
                } else if (operator === ">") {
                    return (attributeValue > comparedValue);
                } else if (operator === ">=") {
                    return (attributeValue != comparedValue);
                } else if (operator === "<") {
                    return (attributeValue != comparedValue);
                } else if (operator === "<=") {
                    return (attributeValue != comparedValue);
                }

            } else if (trigger.type === "instant_trigger") {
                return true;
            }

            return false;
        };

        if (itemData.events?.length > 0) {
            const events = duplicate(itemData.events);

            const triggeredEvents = [];

            for (let eventIndex = 0; eventIndex < events.length; eventIndex++) {
                const event = events[eventIndex];
                if (event.state !== 0) {
                    continue;
                }

                const isTriggered = evaluateTrigger(event.trigger, item, actor);
                if (isTriggered) {
                    triggeredEvents.push(eventIndex);
                }
            }

            if (triggeredEvents.length > 0) {
                for (const eventIndex of triggeredEvents) {
                    const event = events[eventIndex];
                    event.state = 1;
                }

                console.log([`Prepared ${triggeredEvents.length} events for processing.`, item, itemData]);
                item.update({"system.events": events});
            }
        }

        return fact;
    });
}
