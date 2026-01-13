import bcrypt from "bcryptjs";

const hashPassword = async () => {
  const password = "admin1102"; // 👈 đúng y chang mật khẩu muốn login
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  console.log("Plain:", password);
  console.log("Hash:", hashedPassword);
};

hashPassword();
