import express from "express";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import bcrypt from "bcrypt";
import session from "express-session";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname))
    }
  });

const upload = multer({ storage: storage });  

function isAuthenticated(req, res, next) {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied' });
  }
}

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if using HTTPS
}));

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const correctUsername = 'admin';
    const correctPasswordHash = await bcrypt.hash('password123', 10);

    if (username === correctUsername && await bcrypt.compare(password, correctPasswordHash)) {
      req.session.isAuthenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'An error occurred during login' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ success: false, message: 'Error logging out' });
    } else {
      res.json({ success: true });
    }
  });
});

const dataFilePath = path.join(process.cwd(), 'carousel-data.json');

// Read carousel data
async function readCarouselData() {
  try {
    const data = await fs.readFile(dataFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading carousel data:', error);
    return { images: [] };
  }
}

// Write carousel data
async function writeCarouselData(data) {
  try {
    await fs.writeFile(dataFilePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing carousel data:', error);
  }
}

app.post('/upload-image', isAuthenticated, upload.single('image'), async (req, res) => {
    if (req.file) {
      const imageUrl = `/uploads/${req.file.filename}`;
      const carouselData = await readCarouselData();
      carouselData.images.push({ src: imageUrl, alt: "New Image" });
      await writeCarouselData(carouselData);
      res.json({ success: true });
    } else {
      res.status(400).json({ success: false, message: 'No file uploaded' });
    }
  });

app.get("/", async (req, res) => {
  const carouselData = await readCarouselData();
  res.render("index.ejs", { carouselData });
});

app.post('/addImage', isAuthenticated, async (req, res) => {
  console.log('Add image route hit');
  const { imageUrl } = req.body;
  const carouselData = await readCarouselData();
  carouselData.images.push({ src: imageUrl, alt: "New Image" });
  await writeCarouselData(carouselData);
  res.json({ success: true });
});

app.delete('/deleteImage/:index', isAuthenticated, async (req, res) => {
  console.log('Delete image route hit');
  const index = parseInt(req.params.index);
  const carouselData = await readCarouselData();
  if (index >= 0 && index < carouselData.images.length) {
    carouselData.images.splice(index, 1);
    await writeCarouselData(carouselData);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'Invalid index' });
  }
});

app.get('/check-auth', (req, res) => {
  res.json({ isAuthenticated: req.session.isAuthenticated === true });
});

app.get('/news', async (req, res) => {
  const newsData = await readNewsData();
  res.json(newsData);
});

app.post('/news', isAuthenticated, async (req, res) => {
  const { text } = req.body;
  const newsData = await readNewsData();
  newsData.items.push(text);
  await writeNewsData(newsData);
  res.json({ success: true });
});

app.delete('/news', isAuthenticated, async (req, res) => {
  const newsData = await readNewsData();
  if (newsData.items.length > 0) {
    newsData.items.pop();
    await writeNewsData(newsData);
    res.json({ success: true });
  } else {
    res.status(400).json({ success: false, message: 'No news items to remove' });
  }
});

// Functions to read and write news data
async function readNewsData() {
  try {
    const data = await fs.readFile('news-data.json', 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading news data:', error);
    return { items: [] };
  }
}

async function writeNewsData(data) {
  try {
    await fs.writeFile('news-data.json', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing news data:', error);
  }
}


app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
