const Category = require("../model/category");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const categoryController = {
  addCategory: async (req, res) => {
    try {
      const { name, description, image, categoryId } = req.body;

      if (categoryId) {
        const parentExists = await Category.findById(categoryId);
        if (!parentExists) return error(res, appString.PARENTCATEGORY, 404);
      }
      const category = await Category.create({
        name,
        description,
        image,
        categoryId: categoryId || null,
      });

      const successMessage = categoryId
        ? appString.SUBCATEGORYSUCCESS
        : appString.CATEGORYSUCCESS;

      return success(res, category, successMessage, 201);
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  listCategories: async (req, res) => {
    try {
      const { search } = req.query;
      const searchRegex = search ? new RegExp(search, "i") : null;

      const categories = await Category.aggregate([
        { $match: { categoryId: null, status: 1 } },

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
              { "sub.status": 1, ...(search && { "sub.name": searchRegex }) },
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
            subcategories: {
              $push: {
                $cond: [
                  {
                    $and: [
                      { $gt: ["$sub", null] },
                      { $eq: ["$sub.status", 1] },
                      search
                        ? {
                          $regexMatch: {
                            input: "$sub.name",
                            regex: search,
                            options: "i",
                          },
                        }
                        : true,
                    ],
                  },
                  "$sub",
                  "$$REMOVE",
                ],
              },
            },
          },
        },
        {
          $match: search
            ? {
              $or: [
                { name: searchRegex },
                { "subcategories.0": { $exists: true } },
              ],
            }
            : {},
        },
      ]);

      if (search && categories.length === 0) {
        const parentExists = await Category.findOne({
          categoryId: null,
          name: searchRegex,
          status: 1,
        });
        return error(
          res,
          parentExists
            ? appString.SUBCATEGORYNOTFOUND
            : appString.CATEGORYNOTFOUND,
          404,
        );
      }

      return success(res, categories, appString.CATEGORYFECTH);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await Category.findByIdAndUpdate(id, req.body, {
        new: 1,
      });

      if (!updated) return err(res, appString.PARENTCATEGORY, 404);

      const type = updated.categoryId ? "Subcategory" : "Category";
      return success(res, updated, `${type} updated successfully`);
    } catch (error) {
      return err(res, error.message, 400);
    }
  },
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;

      const category = await Category.findById(id);
      if (!category) return err(res, appString.PARENTCATEGORY, 404);

      const type = category.categoryId ? "Subcategory" : "Category";

      await Category.updateOne(
        { $or: [{ _id: id }, { categoryId: id }] },
        {
          $set: {
            isDeleted: 1,
            status: 0,
          },
        },
      );

      return success(res, null, `${type} deleted Successfully`);
    } catch (error) {
      return err(res, error.message, 400);
    }
  },
  reactivateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const category = await Category.findById(id);

      if (!category) return err(res, appString.PARENTCATEGORY, 404);

      const type = category.categoryId ? "Subcategory" : "Category";

      await Category.updateOne(
        { $or: [{ _id: id }, { categoryId: id }] },
        { $set: { status: 1 } },
      );

      return success(res, null, `${type} reactivated successfully`);
    } catch (error) {
      return err(res, error.message, 400);
    }
  },
};

module.exports = categoryController;
