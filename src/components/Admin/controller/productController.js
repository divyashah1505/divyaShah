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
  try {
    console.log("ADD PRODUCT - Body:", req.body);
    console.log("ADD PRODUCT - Files:", req.files ? req.files.length : 0);

    const { name, description, categoryId, variants } = req.body;

    if (!categoryId) {
      return error(res, "Category ID is required", 400);
    }

    let imageUrls = [];

    // multiple image upload
    if (req.files && req.files.length > 0) {
      for (let file of req.files) {
        try {
          const uploadedImage = await uploadToCloudinary(
            file.buffer,
            "products"
          );
          imageUrls.push(uploadedImage.url);
        } catch (cloudErr) {
          console.error("Cloudinary Upload Error:", cloudErr);
          throw new Error("Image upload failed: " + cloudErr.message);
        }
      }
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
      return error(res, "The selected category is not a subcategory (no parent category).", 400);
    }

    const mainCategory = await Category.findById(mainId);

    if (!mainCategory || mainCategory.status !== 1) {
      return error(res, appString.CATEGORY_INACTIVE, 400);
    }

    // parse variants safely
    let parsedVariants = [];
    if (variants) {
      try {
        parsedVariants = typeof variants === "string" ? JSON.parse(variants) : variants;
      } catch (parseErr) {
        return error(res, "Invalid variants JSON format", 400);
      }
    }

    const product = await Product.create({
      name,
      description,
      images: imageUrls,
      maincategoryId: mainId,
      categoryId,
      variants: Array.isArray(parsedVariants) ? parsedVariants : [],
    });

    return success(res, product, appString.PRODUCTCREATED, 201);
  } catch (err) {
    console.error("ADD PRODUCT ERROR:", err);
    return error(res, err.message || "Internal Server Error", 500);
  }
},

  // =========================
  // UPDATE PRODUCT
  // =========================
 updateProduct: async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      qty,
      price,
      categoryId,
      status,
      variants,
    } = req.body;

    const product = await Product.findById(id);

    if (!product) {
      return error(res, appString.PRODUCT_NOT_FOUND, 404);
    }

    const updateData = {
      name: name ?? product.name,
      description: description ?? product.description,
      status: status !== undefined ? Number(status) : product.status,
    };

    // Handle Variants
    if (variants) {
      try {
        updateData.variants = typeof variants === "string" ? JSON.parse(variants) : variants;
      } catch (parseErr) {
        return error(res, "Invalid variants JSON format", 400);
      }
    } else if (price !== undefined || qty !== undefined) {
      // Handle Variants (Legacy support: Update first variant if price/qty provided)
      const updatedVariants = [...(product.variants || [])];
      if (updatedVariants.length === 0) {
        updatedVariants.push({
          size: "Standard",
          color: "Default",
          price: Number(price) || 0,
          stock: Number(qty) || 0,
        });
      } else {
        updatedVariants[0] = {
          ...updatedVariants[0],
          price: price !== undefined ? Number(price) : updatedVariants[0].price,
          stock: qty !== undefined ? Number(qty) : updatedVariants[0].stock,
        };
      }
      updateData.variants = updatedVariants;
    }

    // Handle multiple image uploads
    if (req.files && req.files.length > 0) {
      let imageUrls = [];
      for (let file of req.files) {
        try {
          const uploadedImage = await uploadToCloudinary(
            file.buffer,
            "products"
          );
          imageUrls.push(uploadedImage.url);
        } catch (cloudErr) {
          console.error("Cloudinary Upload Error:", cloudErr);
        }
      }
      if (imageUrls.length > 0) {
        updateData.images = imageUrls;
      }
    }

    // ✅ Category Validation
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

    const updatedProduct = await Product.findByIdAndUpdate(
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
            images: 1,
            variants: 1,
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