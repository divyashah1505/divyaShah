// const Category = require("../model/category");
// const { success, error } = require("../../utils/commonUtils");
// const { appString } = require("../../utils/appString");
// const { upload } = require("../../../middleware");
// const multer = require("multer");

// const categoryController = {
//   addCategory: async (req, res) => {
//     upload(req, res, async (err) => {
//       try {
//         if (err instanceof multer.MulterError) {
//           return error(res, `Multer Error: ${err.message}`, 400);
//         } else if (err) {
//           return error(res, err.message, 400);
//         }

//         const { name, description, categoryId, image } = req.body;

//         console.log("Add Category - Body:", req.body);
//         console.log("Add Category - Files:", req.files);

//         // Handle image from file upload or string path
//         let imageName = null;
//         if (req.files && req.files.length > 0) {
//           imageName = req.files[0].filename;
//         } else if (image && typeof image === 'string') {
//           imageName = image;
//         }

//         console.log("Add Category - Final imageName:", imageName);

//         if (categoryId) {
//           const parentExists = await Category.findById(categoryId);
//           if (!parentExists) return error(res, appString.PARENTCATEGORY, 404);
//         }

//         const category = await Category.create({
//           name,
//           description,
//           image: imageName,
//           categoryId: categoryId || null,
//         });

//         const successMessage = categoryId
//           ? appString.SUBCATEGORYSUCCESS
//           : appString.CATEGORYSUCCESS;

//         return success(res, category, successMessage, 201);
//       } catch (err) {
//         return error(res, err.message, 400);
//       }
//     });
//   },

//   updateCategory: async (req, res) => {
//     upload(req, res, async (err) => {
//       try {
//         if (err) return error(res, err.message, 400);

//         const { id } = req.params;
//         const { name, description, image } = req.body;

//         const updateData = { name, description };

//         if (req.files && req.files.length > 0) {
//           updateData.image = `/uploads/IMG/${req.files[0].filename}`;
//         } else if (image && typeof image === 'string') {
//           updateData.image = image;
//         }

//         const updated = await Category.findByIdAndUpdate(id, updateData, { new: true });

//         if (!updated) return error(res, "Category not found", 404);

//         const type = updated.categoryId ? "Subcategory" : "Category";
//         return success(res, updated, `${type} updated successfully`);
//       } catch (err) {
//         return error(res, err.message, 400);
//       }
//     });
//   },

//   listCategories: async (req, res) => {
//     try {
//       const { search } = req.query;
//       const searchRegex = search ? new RegExp(search, "i") : null;

//       const categories = await Category.aggregate([
//         { $match: { categoryId: null, status: 1, isDeleted: { $ne: 1 } } },
//         {
//           $lookup: {
//             from: "categories",
//             localField: "_id",
//             foreignField: "categoryId",
//             as: "sub",
//           },
//         },
//         { $unwind: { path: "$sub", preserveNullAndEmptyArrays: true } },
//         {
//           $match: {
//             $or: [
//               { "sub.status": 1, "sub.isDeleted": { $ne: 1 }, ...(search && { "sub.name": searchRegex }) },
//               { sub: { $exists: false } },
//               { name: searchRegex },
//             ],
//           },
//         },
//         {
//           $group: {
//             _id: "$_id",
//             name: { $first: "$name" },
//             description: { $first: "$description" },
//             status: { $first: "$status" },
//             image: { $first: "$image" },
//             subcategories: {
//               $push: {
//                 $cond: [
//                   {
//                     $and: [
//                       { $gt: ["$sub", null] },
//                       { $eq: ["$sub.status", 1] },
//                     ],
//                   },
//                   "$sub",
//                   "$$REMOVE",
//                 ],
//               },
//             },
//           },
//         },
//       ]);

//       return success(res, categories, appString.CATEGORYFECTH);
//     } catch (err) {
//       return error(res, err.message, 500);
//     }
//   },
//   deleteCategory: async (req, res) => {
//     try {
//       const { id } = req.params;
//       const category = await Category.findById(id);
//       if (!category) return error(res, appString.PARENTCATEGORY, 404);

//       const type = category.categoryId ? "Subcategory" : "Category";

//       await Category.updateOne(
//         { $or: [{ _id: id }, { categoryId: id }] },
//         { $set: { isDeleted: 1, status: 0 } }
//       );

//       return success(res, null, `${type} deleted Successfully`);
//     } catch (err) {
//       return error(res, err.message, 400);
//     }
//   },

//   reactivateCategory: async (req, res) => {
//     try {
//       const { id } = req.params;
//       const category = await Category.findById(id);
//       if (!category) return error(res, appString.PARENTCATEGORY, 404);

//       const type = category.categoryId ? "Subcategory" : "Category";

//       await Category.updateOne(
//         { $or: [{ _id: id }, { categoryId: id }] },
//         { $set: { status: 1 } }
//       );

//       return success(res, null, `${type} reactivated successfully`);
//     } catch (err) {
//       return error(res, err.message, 400);
//     }
//   },
// };

// module.exports = categoryController;
const Category = require("../model/category");
const { success, error } = require("../../utils/commonUtils");
const { appString } = require("../../utils/appString");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const categoryController = {

  // ---------------- ADD CATEGORY ----------------
   addCategory: async (req, res) => {
    try {
      const { name, description, categoryId } = req.body;

      let imageUrl = null;

if (req.file) {
  try {
    const uploaded = await uploadToCloudinary(req.file.buffer, "categories");
    console.log("CLOUDINARY RESPONSE:", uploaded);

    imageUrl = uploaded.url;
  } catch (cloudErr) {
    console.error("CLOUDINARY FAILED:", cloudErr);
    return res.status(500).json({
      success: false,
      message: "Image upload failed",
      error: cloudErr.message,
    });
  }
}

      if (categoryId) {
        const parent = await Category.findById(categoryId);

        if (!parent) {
          return error(res, appString.PARENTCATEGORY, 404);
        }
      }

      const category = await Category.create({
        name,
        description,
        image: imageUrl,
        categoryId: categoryId || null,
      });

      return success(
        res,
        category,
        categoryId
          ? appString.SUBCATEGORYSUCCESS
          : appString.CATEGORYSUCCESS,
        201
      );
    } catch (err) {
  console.error("Category Error:", err);
  return error(
    res,
    err.message || "Something went wrong",
    500
  );
}},


  // ---------------- UPDATE CATEGORY ----------------
 updateCategory: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const updateData = { name, description };

      if (req.files && req.files.length > 0) {
        const uploaded = await uploadToCloudinary(
          req.files[0].buffer,
          "categories"
        );

        updateData.image = uploaded.url;
      }

      const updated = await Category.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );

      if (!updated) {
        return error(res, "Category not found", 404);
      }

      return success(res, updated, "Category updated successfully");
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  // ---------------- LIST CATEGORY ----------------
  listCategories: async (req, res) => {
    try {
      const { search } = req.query;
      const regex = search ? new RegExp(search, "i") : null;

      const categories = await Category.aggregate([
        {
          $match: {
            categoryId: null,
            isDeleted: { $ne: 1 },
            ...(regex && { name: regex }),
          },
        },
        {
          $lookup: {
            from: "categories",
            localField: "_id",
            foreignField: "categoryId",
            as: "sub",
          },
        },
        {
          $addFields: {
            subcategories: {
              $filter: {
                input: "$sub",
                as: "s",
                cond: { $eq: ["$$s.status", 1] },
              },
            },
          },
        },
        {
          $project: {
            name: 1,
            description: 1,
            status: 1,
            image: 1,
            subcategories: 1,
          },
        },
      ]);

      return success(res, categories, appString.CATEGORYFECTH);
    } catch (err) {
      return error(res, err.message, 500);
    }
  },

  // ---------------- DELETE ----------------
  deleteCategory: async (req, res) => {
    try {
      const { id } = req.params;

      await Category.updateOne(
        { $or: [{ _id: id }, { categoryId: id }] },
        { $set: { isDeleted: 1, status: 0 } }
      );

      return success(res, null, "Deleted successfully");
    } catch (err) {
      return error(res, err.message, 400);
    }
  },

  // ---------------- REACTIVATE ----------------
  reactivateCategory: async (req, res) => {
    try {
      const { id } = req.params;

      await Category.updateOne(
        { $or: [{ _id: id }, { categoryId: id }] },
        { $set: { status: 1 } }
      );

      return success(res, null, "Reactivated successfully");
    } catch (err) {
      return error(res, err.message, 400);
    }
  },
};

module.exports = categoryController;