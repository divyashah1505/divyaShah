const Product = require("../Admin/model/product");
const { broadcastEvent } = require("../user/controller/socketController");

/**
 * Deducts stock from a product and its variant, then broadcasts the update.
 * @param {string} productId - The product ID
 * @param {string} variantId - (Optional) The variant ID
 * @param {number} quantity - The quantity to deduct
 */
const deductStock = async (productId, variantId, quantity) => {
    try {
        const productDoc = await Product.findById(productId);
        if (!productDoc) {
            console.error(`[InventoryUtils] Product not found: ${productId}`);
            return null;
        }

        let newStock = 0;
        let updated = false;

        if (variantId) {
            const variant = productDoc.variants.id(variantId);
            if (variant) {
                const oldStock = variant.stock;
                variant.stock = Math.max(0, variant.stock - quantity);
                newStock = variant.stock;
                updated = true;
                console.log(`[InventoryUtils] Stock updated for ${productDoc.name} (${variant.size}). ${oldStock} -> ${newStock}`);
            } else {
                console.error(`[InventoryUtils] Variant not found: ${variantId} in product ${productDoc.name}`);
            }
        } else if (productDoc.qty !== undefined) {
            // Fallback for legacy products without variants
            const oldStock = productDoc.qty;
            productDoc.qty = Math.max(0, productDoc.qty - quantity);
            newStock = productDoc.qty;
            updated = true;
            console.log(`[InventoryUtils] Legacy stock updated for ${productDoc.name}. ${oldStock} -> ${newStock}`);
        }

        if (updated) {
            await productDoc.save();
            
            // Broadcast the update to all connected clients
            broadcastEvent('stockUpdated', {
                productId,
                variantId,
                newStock,
                totalStock: productDoc.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) || productDoc.qty
            });
            
            return { productId, variantId, newStock };
        }
        
        return null;
    } catch (error) {
        console.error(`[InventoryUtils] Error deducting stock for ${productId}:`, error.message);
        return null;
    }
};

module.exports = {
    deductStock
};
