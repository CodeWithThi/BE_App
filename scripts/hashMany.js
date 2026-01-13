// hashMany.js
import bcrypt from "bcryptjs";

const passwords = [
  { userName: "adminThi", plain: "dinhthi1" },
  { userName: "adminSep", plain: "sep1234" },
  { userName: "adminPMO", plain: "leminhtien" },
  { userName: "pmo_mai", plain: "pmo12345" },
  { userName: "pmo_khanh", plain: "pmo12345" },
  { userName: "dt_nhat_mgr", plain: "dt123456" },
  { userName: "dt_han_mgr", plain: "dt123456" },
  { userName: "gv_han_1", plain: "gv123456" },
   { userName: "gv_nhat_1", plain: "gv123456" },
  // ... thêm những account khác nếu muốn
];

const run = async () => {
  for (const item of passwords) {
    const hash = await bcrypt.hash(item.plain, 10);
    console.log(
      `${item.userName} | plain: ${item.plain} | hash: ${hash}`
    );
  }
};

run().then(() => {
  console.log("DONE");
  process.exit(0);
});
