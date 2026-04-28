const Category = require("../model/category");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const { upload } = require("../../../middleware"); 
const multer = require("multer");

const categoryController = {
  addCategory: async (req, res) => {
    upload(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          return error(res, `Multer Error: ${err.message}`, 400);
        } else if (err) {
          return error(res, err.message, 400);
        }

        const { name, description, categoryId, image } = req.body;
        
        // Handle image from file upload or string path
        let imageName = null;
        if (req.files && req.files.length > 0) {
          imageName = req.files[0].filename; 
        } else if (image && typeof image === 'string') {
          imageName = image; 
        }

        if (categoryId) {
          const parentExists = await Category.findById(categoryId);
          if (!parentExists) return error(res, appString.PARENTCATEGORY, 404);
        }

        const category = await Category.create({
          name,
          description,
          image: imageName, 
          categoryId: categoryId || null,
        });

        const successMessage = categoryId
          ? appString.SUBCATEGORYSUCCESS
          : appString.CATEGORYSUCCESS;

        return success(res, category, successMessage, 201);
      } catch (err) {
        return error(res, err.message, 400);
      }
    });
  },

  updateCategory: async (req, res) => {
    upload(req, res, async (err) => {
      try {
        if (err) return error(res, err.message, 400);

        const { id } = req.params;
        const { name, description, image } = req.body;
        
        const updateData = { name, description };

        if (req.files && req.files.length > 0) {
          updateData.image = req.files[0].filename;
        } else if (image && typeof image === 'string') {
          updateData.image = image;
        }

        const updated = await Category.findByIdAndUpdate(id, updateData, { new: true });

        if (!updated) return error(res, "Category not found", 404);

        const type = updated.categoryId ? "Subcategory" : "Category";
        return success(res, updated, `${type} updated successfully`);
      } catch (err) {
        return error(res, err.message, 400);
      }
    });
  },

  listCategories: async (req, res) => {
    try {
      const { search } = req.query;
      const searchRegex = search ? new RegExp(search, "i") : null;

      const categories = await Category.aggregate([
        { $match: { categoryId: null, status: 1, isDeleted: { $ne: 1 } } },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "categoryId",
            as: "sub",
          },
        },
        { $unwind: { path: "$sub", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { "sub.status": 1, "sub.isDeleted": { $ne: 1 }, ...(search && { "sub.name": searchRegex }) },
              { sub: { $exists: false } },
              { name: searchRegex },
            ],
          },
        },
        {
          $group: {
            _id: "$_id",
            name: { $first: "$name" },
            description: { $first: "$description" },
            status: { $first: "$status" },
            image: { $first: "$image" },
            subcategories: {
              $push: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$sub", null] },
                      { $eq: ["$sub.status", 1] },
                    ],
                  },
                  "$sub",
                  "$$REMOVE",
                ],
              },
            },
          },
        },
      ]);

      return success(res, categories, appString.CATEGORYFECTH);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const category = await Category.findById(id);
      if (!category) return error(res, appString.PARENTCATEGORY, 404);

      const type = category.categoryId ? "Subcategory" : "Category";

      await Category.updateOne(
        { $or: [{ _id: id }, { categoryId: id }] },
        { $set: { isDeleted: 1, status: 0 } }
      );

      return success(res, null, `${type} deleted Successfully`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  reactivateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const category = await Category.findById(id);
      if (!category) return error(res, appString.PARENTCATEGORY, 404);

      const type = category.categoryId ? "Subcategory" : "Category";

      await Category.updateOne(
        { $or: [{ _id: id }, { categoryId: id }] },
        { $set: { status: 1 } }
      );

      return success(res, null, `${type} reactivated successfully`);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },
};

module.exports = categoryController;