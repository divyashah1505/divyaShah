const config = require('../../../../config/development.json')
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const SubscriptionPlan = require('../model/SubscriptionPlan'); 
const { appString } = require("../../utils/appString");
const { success, error } = require("../../utils/commonUtils");

const membershipController = {
  addMembershipPlan: async (req, res) => {
    try {
      const { 
        plan_type, name, price, duration_months, 
        discount_percent, max_discount_limit, min_order_amount,
        free_delivery, free_delivery_min_amount, rewards 
      } = req.body;

      const product = await stripe.products.create({
        name: name,
        metadata: { plan_type: plan_type.toString() }
      });

      const stripePrice = await stripe.prices.create({
        unit_amount: Math.round(price * 100),
        currency: 'inr',
        recurring: {
          interval: 'month',
          interval_count: duration_months,
        },
        product: product.id,
      });

      const newPlan = await SubscriptionPlan.create({
        plan_type,
        name,
        price,
        stripe_price_id: stripePrice.id, 
        duration_months,
        discount_percent,
        max_discount_limit,
        min_order_amount,
        free_delivery,
        free_delivery_min_amount,
        rewards,
        is_active: 1
      });

      return success(res, newPlan, appString.PLANCREATED, 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },
  
updateMembershipPlan: async (req, res) => {
    try {
        const { id } = req.params; 
        const { 
            name, 
            plan_type, 
            discount_percent, 
            max_discount_limit, 
            min_order_amount, 
            free_delivery, 
            free_delivery_min_amount, 
            rewards,
            is_active 
        } = req.body;

        const existingPlan = await SubscriptionPlan.findById(id);
        if (!existingPlan) return error(res, appString.PLANNOTFOUND, 404);

        if (existingPlan.stripe_price_id) {
            const stripePrice = await stripe.prices.retrieve(existingPlan.stripe_price_id);
            await stripe.products.update(stripePrice.product, {
                name: name || existingPlan.name,
                metadata: { plan_type: (plan_type || existingPlan.plan_type).toString() }
            });
        }

       
        existingPlan.name = name ?? existingPlan.name;
        existingPlan.plan_type = plan_type ?? existingPlan.plan_type;
        existingPlan.discount_percent = discount_percent ?? existingPlan.discount_percent;
        existingPlan.max_discount_limit = max_discount_limit ?? existingPlan.max_discount_limit;
        existingPlan.min_order_amount = min_order_amount ?? existingPlan.min_order_amount;
        existingPlan.free_delivery = free_delivery ?? existingPlan.free_delivery;
        existingPlan.free_delivery_min_amount = free_delivery_min_amount ?? existingPlan.free_delivery_min_amount;
        existingPlan.rewards = rewards ?? existingPlan.rewards;
        existingPlan.is_active = is_active ?? existingPlan.is_active;

        const updatedPlan = await existingPlan.save();

        return success(res, updatedPlan, appString.PLANUPDATED, 200);
    } catch (err) {
        return error(res, err.message, 400);
    }
},
 disableSubscriptionPlan: async (req, res) => {
try {
     const { id } = req.params;
     const updated = await SubscriptionPlan.findByIdAndUpdate(
       id,
        { is_active: 0 },
        { new: 1 },
      );
       if (updated.stripe_price_id) {
            const stripePrice = await stripe.prices.retrieve(updated.stripe_price_id);
            await stripe.products.update(stripePrice.product, {
                // name: name || updated.name,
                // metadata: { plan_type: (plan_type || updated.plan_type).toString() }

                active:false
            });
        }

      if (!updated) {
        return error(res, appString.PLANNOTFOUND, 404);
      }
       return success(res, null, appString.SUBSCRIPTIONPLANDEACTIVATED, 200);
    }catch(err){
         return error(res, err.message, 400);
    }
  },
   reactivateSubscriptionplan: async (req, res) => {
    try {
     const { id } = req.params;
     const updated = await SubscriptionPlan.findByIdAndUpdate(
       id,
        { is_active: 1 },
        { new: 1 },
      );
       if (updated.stripe_price_id) {
            const stripePrice = await stripe.prices.retrieve(updated.stripe_price_id);
            await stripe.products.update(stripePrice.product, {
                // name: name || updated.name,
                // metadata: { plan_type: (plan_type || updated.plan_type).toString() }

                active:true
            });
        }

      if (!updated) {
        return error(res, appString.PLANNOTFOUND, 404);
      }
       return success(res, null, appString.SUBSCRIPTIONPLANREACTIVATED, 200);
    }catch(err){
         return error(res, err.message, 400);
    }}
    
};
module.exports = membershipController;