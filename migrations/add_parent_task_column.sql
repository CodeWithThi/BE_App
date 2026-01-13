-- Add Parent_T_ID column to Task table
ALTER TABLE `Task` ADD COLUMN `Parent_T_ID` VARCHAR(10) NULL AFTER `Created_By_A_ID`;

-- Add index for Parent_T_ID
ALTER TABLE `Task` ADD INDEX `FK_Task_ParentTask` (`Parent_T_ID`);

-- Add foreign key constraint
ALTER TABLE `Task` 
ADD CONSTRAINT `FK_Task_ParentTask` 
FOREIGN KEY (`Parent_T_ID`) 
REFERENCES `Task`(`T_ID`) 
ON DELETE NO ACTION 
ON UPDATE NO ACTION;
