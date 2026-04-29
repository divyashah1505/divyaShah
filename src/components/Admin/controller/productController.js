const Product = require("../model/product");
const Category = require("../model/category");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const { upload } = require("../../../middleware");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const multer = require("multer");

const productController = {
  // =========================
  // ADD PRODUCT
  // =========================
  addProduct: async (req, res) => {
    upload(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          return error(res, `Multer Error: ${err.message}`, 400);
        }

        if (err) {
          return error(res, err.message, 400);
        }

        const {
          name,
          description,
          qty,
          price,
          categoryId,
        } = req.body;

        // Upload image to Cloudinary
        let imageUrl = null;

        if (req.files?.length > 0) {
          const uploadedImage = await uploadToCloudinary(
            req.files[0].buffer,
            "products"
          );

          imageUrl = uploadedImage.url;
        }

        // Validate Sub Category
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

        // Validate Main Category
        const mainCategory = await Category.findById(mainId);

        if (!mainCategory || mainCategory.status !== 1) {
          return error(res, appString.CATEGORY_INACTIVE, 400);
        }

        const product = await Product.create({
          name,
          description,
          image: imageUrl,
          qty: Number(qty) || 0,
          price: Number(price) || 0,
          maincategoryId: mainId,
          categoryId,
        });

        return success(
          res,
          product,
          appString.PRODUCTCREATED,
          201
        );
      } catch (err) {
        return error(res, err.message, 400);
      }
    });
  },

  // =========================
  // UPDATE PRODUCT
  // =========================
  updateProduct: async (req, res) => {
    upload(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          return error(res, `Multer Error: ${err.message}`, 400);
        }

        if (err) {
          return error(res, err.message, 400);
        }

        const { id } = req.params;
        const {
          name,
          description,
          qty,
          price,
          categoryId,
          status,
        } = req.body;

        const product = await Product.findById(id);

        if (!product) {
          return error(res, appString.PRODUCT_NOT_FOUND, 404);
        }

        const updateData = {
          name: name ?? product.name,
          description: description ?? product.description,
          qty: qty !== undefined ? Number(qty) : product.qty,
          price: price !== undefined ? Number(price) : product.price,
          status: status !== undefined
            ? Number(status)
            : product.status,
        };

        // Upload new image if provided
        if (req.files?.length > 0) {
          const uploadedImage = await uploadToCloudinary(
            req.files[0].buffer,
            "products"
          );

          updateData.image = uploadedImage.url;
        }

        // Category Validation
        if (categoryId) {
          const subCategory = await Category.findById(categoryId);

          if (!subCategory) {
            return error(res, appString.SUBCATEGORYNOTFOUND, 404);
          }

          if (subCategory.status !== 1) {
            return error(
              res,
              appString.SUBCATEGORY_INACTIVE,
              400
            );
          }

          const mainId = subCategory.categoryId;

          if (!mainId) {
            return error(
              res,
              appString.NOT_A_SUBCATEGORY,
              400
            );
          }

          const mainCategory = await Category.findById(mainId);

          if (!mainCategory || mainCategory.status !== 1) {
            return error(
              res,
              appString.CATEGORY_INACTIVE,
              400
            );
          }

          updateData.categoryId = categoryId;
          updateData.maincategoryId = mainId;
        }

        const updatedProduct =
          await Product.findByIdAndUpdate(
            id,
            { $set: updateData },
            {
              new: true,
              runValidators: true,
            }
          );

        return success(
          res,
          updatedProduct,
          appString.USER_UPDATED,
          200
        );
      } catch (err) {
        return error(res, err.message, 400);
      }
    });
  },

  // =========================
  // DELETE PRODUCT
  // =========================
  deleteProduct: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await Product.findByIdAndUpdate(
        id,
        { status: 0 },
        { new: true }
      );

      if (!updated) {
        return error(
          res,
          appString.PRODUCT_NOT_FOUND,
          404
        );
      }

      return success(
        res,
        null,
        appString.PRODUCTDELETED,
        200
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  // =========================
  // REACTIVATE PRODUCT
  // =========================
  reactivateProduct: async (req, res) => {
    try {
      const { id } = req.params;

      const updated = await Product.findByIdAndUpdate(
        id,
        { status: 1 },
        { new: true }
      );

      if (!updated) {
        return error(
          res,
          appString.PRODUCT_NOT_FOUND,
          404
        );
      }

      return success(
        res,
        updated,
        appString.PRODUCTREACTIVATED,
        200
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  // =========================
  // LIST PRODUCTS
  // =========================
  listProducts: async (req, res) => {
    try {
      const { search } = req.query;
      const searchRegex = search
        ? new RegExp(search, "i")
        : null;

      const data = await Product.aggregate([
        {
          $match: {
            isDeleted: { $ne: 1 },
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "maincategoryId",
            foreignField: "_id",
            as: "mainCategoryDetails",
          },
        },
        {
          $unwind: "$mainCategoryDetails",
        },
        {
          $lookup: {
            from: "categories",
            localField: "categoryId",
            foreignField: "_id",
            as: "subCategoryDetails",
          },
        },
        {
          $unwind: "$subCategoryDetails",
        },
        ...(search
          ? [
              {
                $match: {
                  $or: [
                    { name: searchRegex },
                    {
                      "subCategoryDetails.name":
                        searchRegex,
                    },
                  ],
                },
              },
            ]
          : []),
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
            mainCategory: {
              _id: "$mainCategoryDetails._id",
              name: "$mainCategoryDetails.name",
            },
            subcategory: {
              _id: "$subCategoryDetails._id",
              name: "$subCategoryDetails.name",
            },
          },
        },
        {
          $sort: {
            createdAt: -1,
          },
        },
      ]);

      return success(
        res,
        data,
        appString.SUCCESS,
        200
      );
    } catch (err) {
      return error(res, err.message, 400);
    }
  },
};

module.exports = productController;