const Product = require("../model/product");
const Category = require("../model/category");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const category = require("../model/category");
const { upload } = require("../../../middleware");
const multer = require("multer");
const productyController = {
   addProduct: async (req, res) => {
    // Wrap the logic in the upload middleware to parse FormData
    upload(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          return error(res, `Multer Error: ${err.message}`, 400);
        } else if (err) {
          return error(res, err.message, 400);
        }

        // Now req.body will contain your fields
        const { name, description, qty, price, categoryId } = req.body;

        // Extract filename from Multer
        let imageName = null;
        if (req.files && req.files.length > 0) {
          imageName = req.files[0].filename; 
        } else if (image && typeof image === 'string') {
          imageName = image;
        }

        const subCategory = await Category.findById(categoryId);
        if (!subCategory) {
          return error(res, appString.SUBCATEGORYNOTFOUND, 404);
        }

        if (subCategory.status !== 1) {
          return error(res, appString.SUBCATEGORY_INACTIVE, 400);
        }

        const mainId = subCategory.categoryId;
        if (!mainId) {
          return error(res, appString.NOT_A_SUBCATEGORY, 400);
        }

        const mainCategory = await Category.findById(mainId);
        if (!mainCategory || mainCategory.status !== 1) {
          return error(res, appString.CATEGORY_INACTIVE, 400);
        }

        const product = await Product.create({
          name,
          description,
          image: imageName, // Use the filename from Multer
          qty: Number(qty) || 0,
          price: Number(price) || 0,
          maincategoryId: mainId,
          categoryId: categoryId,
        });

        return success(res, product, appString.PRODUCTCREATED, 201);
      } catch (err) {
        return error(res, err.message, 400);
      }
    });
  },

updateProduct: async (req, res) => {
    // 1. Wrap logic in upload middleware to parse FormData
    upload(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          return error(res, `Multer Error: ${err.message}`, 400);
        } else if (err) {
          return error(res, err.message, 400);
        }

        const { id } = req.params;
        
        // NOW req.body is available
        const { name, description, image, qty, price, categoryId, status } = req.body;

        const product = await Product.findById(id);
        if (!product) {
          return error(res, appString.NOT_FOUND, 404);
        }

        // Prepare update data
        let updateData = { 
            name, 
            description, 
            qty: qty !== undefined ? Number(qty) : product.qty, 
            price: price !== undefined ? Number(price) : product.price, 
            status: status !== undefined ? Number(status) : product.status 
        };

        // 2. Handle Image Update
        if (req.files && req.files.length > 0) {
          // If a new file is uploaded
          updateData.image = req.files[0].filename;
        } else if (image && typeof image === 'string') {
          // If the existing image path is sent back as a string
          updateData.image = image;
        }

        // 3. Category Validation (Keep your existing logic)
        if (categoryId) {
          const subCategory = await Category.findById(categoryId);
          if (!subCategory) {
            return error(res, appString.SUBCATEGORYNOTFOUND, 404);
          }

          if (subCategory.status !== 1) {
            return error(res, appString.SUBCATEGORY_INACTIVE, 400);
          }

          const mainId = subCategory.categoryId;
          if (!mainId) {
            return error(res, appString.NOT_A_SUBCATEGORY, 400);
          }

          const mainCategory = await Category.findById(mainId);
          if (!mainCategory || mainCategory.status !== 1) {
            return error(res, appString.CATEGORY_INACTIVE, 400);
          }

          updateData.categoryId = categoryId;
          updateData.maincategoryId = mainId;
        }

        const updatedProduct = await Product.findByIdAndUpdate(
          id,
          { $set: updateData },
          { new: true, runValidators: true },
        );

        return success(res, updatedProduct, appString.USER_UPDATED, 200);
      } catch (err) {
        return error(res, err.message, 400);
      }
    });
  },

  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await Product.findByIdAndUpdate(
        id,
        { status: 0 },
        { new: true },
      );

      if (!updated) {
        return error(res, appString.PRODUCT_NOT_FOUND, 404);
      }

      return success(res, null, appString.PRODUCTREACTIVATED, 200);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  reactivateProduct: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await Product.findByIdAndUpdate(
        id,
        { status: 1 },
        { new: true },
      );

      if (!updated) {
        return error(res, appString.PRODUCT_NOT_FOUND, 404);
      }

      return success(res, updated, appString.PRODUCTREACTIVATED, 200);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

listProducts: async (req, res) => {
    try {
      const { search } = req.query;
      const searchRegex = search ? new RegExp(search, "i") : null;

      const data = await Product.aggregate([
        // CHANGE: Remove { status: 1 } to allow deactivated products to show
        { $match: { isDeleted: { $ne: 1 } } }, 

        {
          $lookup: {
            from: "categories",
            localField: "maincategoryId",
            foreignField: "_id",
            as: "mainCategoryDetails",
          },
        },
        { $unwind: "$mainCategoryDetails" },
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "subCategoryDetails",
          },
        },
        { $unwind: "$subCategoryDetails" },
        
        // Search Filter
        {
          $match: search ? {
            $or: [
              { name: searchRegex },
              { "subCategoryDetails.name": searchRegex }
            ]
          } : {}
        },

        {
          $project: {
            _id: 1,
            name: 1,
            description: 1,
            image: 1,
            qty: 1,
            price: 1,
            status: 1, // Ensure status is sent to frontend
            createdAt: 1,
            subcategory: {
              _id: "$subCategoryDetails._id",
              name: "$subCategoryDetails.name",
            },
          },
        },
        { $sort: { createdAt: -1 } },
      ]);

      return success(res, data, appString.SUCCESS, 200);
    } catch (err) {
      return error(res, err.message, 400);
    }
},
};
module.exports = productyController;
