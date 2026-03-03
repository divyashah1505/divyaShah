const Product = require("../model/product");
const Category = require("../model/category");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const category = require("../model/category");

const productyController = {
  addProduct: async (req, res) => {
    try {
      const { name, description, image, qty, price, categoryId } = req.body;

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
      if (!mainCategory) {
        return error(res, appString.PARENTCATEGORY, 404);
      }

      if (mainCategory.status !== 1) {
        return error(res, appString.CATEGORY_INACTIVE, 400);
      }

      const product = await Product.create({
        name,
        description,
        image,
        qty: qty || 0,
        price: price || 0,
        maincategoryId: mainId,
        categoryId: categoryId,
      });

      return success(res, product, appString.PRODUCTCREATED, 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  updateProduct: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description, image, qty, price, categoryId, status } =
        req.body;

      const product = await Product.findById(id);
      if (!product) {
        return error(res, appString.NOT_FOUND, 404);
      }

      let updateData = { name, description, image, qty, price, status };

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
        { new: 1, runValidators: 1 },
      );

      return success(res, updatedProduct, appString.USER_UPDATED, 200);
    } catch (err) {
      return error(res, err.message, 400);
    }
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

      let productMatch = { status: 1 };

      if (search) {
        productMatch.name, category.categoryName = { $regex: search, $options: "i" };
      }

      const data = await Product.aggregate([
        { $match: productMatch },
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
        {
          $match: {
            "mainCategoryDetails.status": 1,
            "subCategoryDetails.status": 1,
          },
        },
        {
          $project: {
            _id: 1,
            name: 1,
            description: 1,
            image: 1,
            qty: 1,
            price: 1,
            status: 1,
            createdAt: 1,
            updatedAt: 1,
            subcategory: {
              _id: "$subCategoryDetails._id",
              name: "$subCategoryDetails.name",
              image: "$subCategoryDetails.image",
              description: "$subCategoryDetails.description",
            },
            mainCategory: {
              _id: "$mainCategoryDetails._id",
              name: "$mainCategoryDetails.name",
              image: "$mainCategoryDetails.image",
              description: "$mainCategoryDetails.description",
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
