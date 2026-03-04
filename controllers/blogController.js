const { Blog } = require('../models');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'public/uploads/blogs/';
    if (!fs.existsSync(uploadDir)){
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Helper for slugify
const slugify = (text) => {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
};

const blogController = {
  // Admin: List all blogs
  adminIndex: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 10;
      const offset = (page - 1) * limit;

      const { count, rows: blogs } = await Blog.findAndCountAll({
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      res.render('admin/blogs/index', {
        title: 'Blog Management',
        user: req.session.user,
        blogs,
        pagination: {
          page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.redirect('/admin/dashboard?error=' + encodeURIComponent('Failed to fetch blogs'));
    }
  },

  // Admin: Show create form
  create: (req, res) => {
    res.render('admin/blogs/create', {
      title: 'Create Blog Post',
      user: req.session.user
    });
  },

  // Admin: Store new blog
  store: [
    upload.single('image'),
    async (req, res) => {
      try {
        const { title, content, is_published } = req.body;
        
        let image_path = null;
        if (req.file) {
          image_path = '/uploads/blogs/' + req.file.filename;
        }

        let slug = slugify(title);
        // Ensure unique slug
        let counter = 1;
        while (await Blog.findOne({ where: { slug } })) {
          slug = `${slugify(title)}-${counter}`;
          counter++;
        }

        await Blog.create({
          title,
          slug,
          content,
          image_path,
          is_published: is_published === 'on' || is_published === 'true'
        });

        res.redirect('/admin/blogs?success=' + encodeURIComponent('Blog created successfully'));
      } catch (error) {
        console.error('Error creating blog:', error);
        res.render('admin/blogs/create', {
          title: 'Create Blog Post',
          user: req.session.user,
          error: 'Failed to create blog',
          formData: req.body
        });
      }
    }
  ],

  // Admin: Show edit form
  edit: async (req, res) => {
    try {
      const blog = await Blog.findByPk(req.params.id);
      if (!blog) {
        return res.redirect('/admin/blogs?error=' + encodeURIComponent('Blog not found'));
      }

      res.render('admin/blogs/edit', {
        title: 'Edit Blog Post',
        user: req.session.user,
        blog
      });
    } catch (error) {
      console.error('Error fetching blog for edit:', error);
      res.redirect('/admin/blogs?error=' + encodeURIComponent('Failed to fetch blog'));
    }
  },

  // Admin: Update blog
  update: [
    upload.single('image'),
    async (req, res) => {
      try {
        const { title, content, is_published } = req.body;
        const blog = await Blog.findByPk(req.params.id);

        if (!blog) {
          return res.redirect('/admin/blogs?error=' + encodeURIComponent('Blog not found'));
        }

        const updateData = {
          title,
          content,
          is_published: is_published === 'on' || is_published === 'true'
        };

        if (req.file) {
          // Delete old image if exists
          if (blog.image_path) {
            const oldImagePath = path.join(__dirname, '../public', blog.image_path);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          }
          updateData.image_path = '/uploads/blogs/' + req.file.filename;
        }
        
        // Update slug if title changed
        if (title !== blog.title) {
            let slug = slugify(title);
            let counter = 1;
            while (await Blog.findOne({ where: { slug, id: { [require('sequelize').Op.ne]: blog.id } } })) {
                slug = `${slugify(title)}-${counter}`;
                counter++;
            }
            updateData.slug = slug;
        }

        await blog.update(updateData);

        res.redirect('/admin/blogs?success=' + encodeURIComponent('Blog updated successfully'));
      } catch (error) {
        console.error('Error updating blog:', error);
        res.redirect(`/admin/blogs/edit/${req.params.id}?error=` + encodeURIComponent('Failed to update blog'));
      }
    }
  ],

  // Admin: Delete blog
  destroy: async (req, res) => {
    try {
      const blog = await Blog.findByPk(req.params.id);
      if (!blog) {
        return res.json({ success: false, message: 'Blog not found' });
      }

      if (blog.image_path) {
        const imagePath = path.join(__dirname, '../public', blog.image_path);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      await blog.destroy();
      res.json({ success: true, message: 'Blog deleted successfully' });
    } catch (error) {
      console.error('Error deleting blog:', error);
      res.json({ success: false, message: 'Failed to delete blog' });
    }
  },

  // Admin: Toggle blog status
  toggleStatus: async (req, res) => {
    try {
      const blog = await Blog.findByPk(req.params.id);
      if (!blog) {
        return res.json({ success: false, message: 'Blog not found' });
      }

      await blog.update({ is_published: !blog.is_published });
      
      const status = blog.is_published ? 'published' : 'unpublished';
      res.json({ success: true, message: `Blog ${status} successfully`, is_published: blog.is_published });
    } catch (error) {
      console.error('Error toggling blog status:', error);
      res.json({ success: false, message: 'Failed to toggle status' });
    }
  },

  // Public: List blogs
  index: async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = 9; // Grid of 3x3
      const offset = (page - 1) * limit;

      const { count, rows: blogs } = await Blog.findAndCountAll({
        where: { is_published: true },
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      const totalPages = Math.ceil(count / limit);

      res.render('blogs/index', {
        title: 'Blog',
        user: req.session.user || null,
        blogs,
        pagination: {
          page,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Error fetching blogs:', error);
      res.redirect('/?error=' + encodeURIComponent('Failed to load blogs'));
    }
  },

  // Public: Show blog detail
  show: async (req, res) => {
    try {
      const whereClause = { slug: req.params.slug };
      
      // If user is not admin, only show published blogs
      if (!req.session.user || req.session.user.role !== 'admin') {
        whereClause.is_published = true;
      }

      const blog = await Blog.findOne({
        where: whereClause
      });

      if (!blog) {
        return res.redirect('/blogs?error=' + encodeURIComponent('Blog post not found or unpublished'));
      }

      // Increment views only for non-admin
      if (!req.session.user || req.session.user.role !== 'admin') {
        await blog.increment('views');
      }

      // Get recent blogs for sidebar
      const recentBlogs = await Blog.findAll({
        where: { 
            is_published: true,
            id: { [require('sequelize').Op.ne]: blog.id }
        },
        order: [['created_at', 'DESC']],
        limit: 5
      });

      res.render('blogs/show', {
        title: blog.title,
        user: req.session.user || null,
        blog,
        recentBlogs
      });
    } catch (error) {
      console.error('Error fetching blog detail:', error);
      res.redirect('/blogs?error=' + encodeURIComponent('Failed to load blog post'));
    }
  }
};

module.exports = blogController;
